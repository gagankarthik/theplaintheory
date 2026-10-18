import { FindingCollector } from "./classify";
import { candidatesFrom, getStore, id, mergeScan, SCAN_LOG_KEEP, trackerPatch, type ScanLogLine, type ScanPage, type ScanReport } from "./app";
import type { CrawlerConfig } from "./config";
import type { Logger } from "./logger";
import { isAllowedUrl, privateNetworkAllowed } from "./net-guard";
import type { Browser } from "puppeteer";
import { launchBrowser } from "./scanner/browser";
import { scanSite } from "./scanner/crawl";
import type { ScanLogLevel, ScanResult } from "./scanner/types";
import { describeLoadError, httpVariant, shouldRetryOverHttp } from "./scanner/load-errors";
import { buildStartUrl } from "./scanner/url";

/**
 * One crawl, start to finish, against the dashboard's store:
 *   claim (queued → running) → crawl with live progress/log → classify → finish (ok/failed)
 *   → merge findings into the site's tracker list (same rules as the dashboard) → audit event.
 * A user cancel (status → cancelled) is noticed at the next progress write and stops the crawl;
 * nothing is merged. A worker shutdown puts the scan back to queued for another worker.
 */

export type JobOutcome = "completed" | "failed" | "cancelled" | "skipped" | "interrupted";

export interface JobContext {
  config: CrawlerConfig;
  log: Logger;
  /** Worker shutdown (SIGTERM): stop and hand the scan back. */
  signal: AbortSignal;
}

const LEVEL: Record<ScanLogLevel, ScanLogLine["level"] | null> = { DEBUG: null, INFO: "info", WARN: "warn", ERROR: "error" };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Claims a queued scan. `reclaim` also takes one left running by a worker that died (SQS redelivery). */
export async function claimScan(propertyId: string, scanId: string, workerId: string, reclaim = false): Promise<ScanReport | null> {
  const store = await getStore();
  const current = await store.getScan(propertyId, scanId);
  if (!current) return null;
  const at = new Date().toISOString();
  const resumed = current.status === "running";
  return store.updateScan(
    propertyId,
    scanId,
    {
      status: "running",
      workerId,
      log: [
        ...(current.log ?? []),
        { at, level: resumed ? ("warn" as const) : ("info" as const), message: resumed ? "Restarted after the previous crawler stopped." : "Crawler started." },
      ].slice(-SCAN_LOG_KEEP),
    },
    { ifStatus: reclaim ? ["queued", "running"] : ["queued"] },
  );
}

/** Turns crawler page results into the report's page list (same shape as the fetch scanner). */
function toScanPages(result: ScanResult): ScanPage[] {
  const pages: ScanPage[] = result.pages.map((p) => ({
    url: p.finalUrl || p.url,
    status: p.status,
    ...(p.error ? { note: p.error.slice(0, 200) } : p.status !== null && p.status >= 400 ? { note: `HTTP ${p.status}` } : {}),
  }));
  for (const url of result.skippedByRobots.slice(0, 50)) pages.push({ url, status: null, note: "Skipped: robots.txt asks us not to." });
  return pages;
}

export async function runClaimedScan(report: ScanReport, ctx: JobContext): Promise<JobOutcome> {
  const store = await getStore();
  const { propertyId, id: scanId } = report;
  const log = ctx.log.child({ propertyId, scanId });

  const property = await store.getProperty(propertyId);
  if (!property) {
    await store.updateScan(propertyId, scanId, { status: "failed", finishedAt: new Date().toISOString(), error: "This site no longer exists." }, { ifStatus: ["running"] });
    return "failed";
  }

  const lines: ScanLogLine[] = [...(report.log ?? [])];
  const pushLine = (level: ScanLogLine["level"], message: string, url?: string | null, detail?: string) => {
    lines.push({ at: new Date().toISOString(), level, message: message.slice(0, 500), ...(url ? { url: url.slice(0, 500) } : {}), ...(detail ? { detail: detail.slice(0, 2000) } : {}) });
    if (lines.length > SCAN_LOG_KEEP) lines.splice(0, lines.length - SCAN_LOG_KEEP);
  };

  const limits = report.limits ?? { maxPages: 25, maxDepth: 2 };
  let startUrl = buildStartUrl(property.domain);
  const collector = new FindingCollector(new URL(startUrl).hostname);
  const crawlAbort = new AbortController();
  const onShutdown = () => crawlAbort.abort();
  ctx.signal.addEventListener("abort", onShutdown, { once: true });

  let cancelled = false;
  let progress = { pagesScanned: 0, pagesQueued: 1, findings: 0 };
  let lastWrite = 0;
  let writing: Promise<void> = Promise.resolve();

  // Progress writes double as the cancellation check: they only apply while the scan is running.
  const flush = (force = false) => {
    if (cancelled) return writing;
    if (!force && Date.now() - lastWrite < ctx.config.progressIntervalMs) return writing;
    lastWrite = Date.now();
    const snapshot = { progress: { ...progress }, log: [...lines] };
    writing = writing.then(async () => {
      const updated = await store.updateScan(propertyId, scanId, snapshot, { ifStatus: ["running"] }).catch((e: unknown) => {
        log.warn("Progress write failed", { err: e });
        return undefined;
      });
      if (updated === null && !cancelled) {
        cancelled = true;
        crawlAbort.abort();
        log.info("Scan was cancelled; stopping");
      }
    });
    return writing;
  };

  // One browser for the whole job, shared by the https attempt and any http fallback. A second
  // Chromium launch in a long-lived worker process can't load http:// pages (it fails with
  // ERR_BLOCKED_BY_CLIENT), and one launch per job is cheaper anyway.
  let browser: Browser | undefined;
  try {
    if (!(await isAllowedUrl(startUrl))) {
      pushLine("error", "That domain points to a private or internal network address, so it can't be scanned.", startUrl);
      await store.updateScan(
        propertyId,
        scanId,
        { status: "failed", finishedAt: new Date().toISOString(), error: "That domain points to a private network address, so it can't be scanned.", log: lines },
        { ifStatus: ["running"] },
      );
      return "failed";
    }
    if (privateNetworkAllowed()) pushLine("warn", "Private network addresses are allowed (local development).");
    pushLine("info", `Starting at ${startUrl}`, startUrl);
    await flush(true);

    browser = await launchBrowser();
    const shared = browser;
    const crawl = (from: string) =>
      scanSite({
      startUrl: from,
      maxDepth: limits.maxDepth,
      maxPages: limits.maxPages,
      pageTimeoutMs: ctx.config.pageTimeoutMs,
      settleMs: ctx.config.settleMs,
      pageDelayMs: ctx.config.pageDelayMs,
      deadlineMs: ctx.config.scanDeadlineMs,
      signal: crawlAbort.signal,
      guard: isAllowedUrl,
      onLog: (level, message, url, meta) => {
        const mapped = LEVEL[level];
        if (!mapped) return;
        const detail = typeof meta?.stack === "string" ? meta.stack : meta?.blocked ? JSON.stringify(meta.blocked) : undefined;
        pushLine(mapped, message, url, detail);
        void flush();
      },
      onPage: (page) => {
        try {
          collector.addHtmlPage(page);
        } catch (e) {
          pushLine("warn", `Couldn't classify the page HTML: ${errorText(e)}`, page.url);
        }
      },
      onProgress: (p) => {
        progress = { pagesScanned: p.pagesScanned, pagesQueued: p.pagesQueued, findings: collector.size };
        void flush();
      },
    }, shared);
    let result = await crawl(startUrl);
    // HTTPS refused, reset or with a broken certificate: try plain http once before giving up.
    const firstTry = result.pages[0];
    if (!result.pages.some((pg) => pg.ok) && !crawlAbort.signal.aborted && shouldRetryOverHttp(startUrl, firstTry?.error ?? undefined)) {
      const fallback = httpVariant(startUrl);
      if (await isAllowedUrl(fallback)) {
        pushLine("warn", "HTTPS didn't answer; trying http:// instead.", fallback);
        await flush(true);
        startUrl = fallback;
        result = await crawl(startUrl);
      }
    }
    await writing;

    if (ctx.signal.aborted && !cancelled) {
      // Worker shutdown mid-crawl: hand the scan back so another worker (or this one, restarted) redoes it.
      pushLine("warn", "The crawler was stopped; the scan will restart.");
      await store.updateScan(propertyId, scanId, { status: "queued", workerId: undefined, log: lines }, { ifStatus: ["running"] });
      return "interrupted";
    }
    if (cancelled) return "cancelled";

    collector.setSiteHost(result.siteHost);
    collector.addRequestHosts(result.requestHosts);
    collector.addCookies(result.cookies);
    collector.addStorage(result.storage);
    const { findings, preConsent } = collector.result();
    const pages = toScanPages(result);
    const loaded = result.pages.filter((p) => p.ok);
    const finishedAt = new Date().toISOString();
    progress = { pagesScanned: result.pages.length, pagesQueued: 0, findings: findings.length };

    if (!loaded.length) {
      const first = result.pages[0];
      const error = first?.error
        ? describeLoadError(first.error, startUrl)
        : first?.status
          ? `Your homepage answered with HTTP ${first.status}. Check the site is live and public.`
          : result.skippedByRobots.length
            ? "Your robots.txt asks crawlers not to read your homepage."
            : "We couldn't load your homepage.";
      pushLine("error", error, startUrl);
      await store.updateScan(propertyId, scanId, { status: "failed", finishedAt, error, pages, findings: [], progress, log: lines }, { ifStatus: ["running"] });
      return "failed";
    }

    if (result.timedOut) {
      const minutes = Math.round(ctx.config.scanDeadlineMs / 60_000);
      pushLine("warn", `Stopped at the ${minutes}-minute time limit; these results cover the ${result.pages.length} page(s) scanned so far.`);
      log.warn("Scan hit its time limit; recording partial results", { deadlineMs: ctx.config.scanDeadlineMs, pages: result.pages.length });
    }
    if (preConsent.length) {
      pushLine("warn", `Loaded before any consent: ${preConsent.slice(0, 12).join(", ")}${preConsent.length > 12 ? ` and ${preConsent.length - 12} more` : ""}`);
    }
    pushLine("info", `Done: ${loaded.length} page(s), ${findings.length} finding(s).`);
    const done = await store.updateScan(
      propertyId,
      scanId,
      { status: "ok", finishedAt, homeUrl: result.startUrl, pages, findings, progress, preConsent, log: lines },
      { ifStatus: ["running"] },
    );
    if (!done) return "cancelled";

    // Fold into the tracker list exactly like the dashboard's scanTrackers action does.
    const fresh = (await store.getProperty(propertyId)) ?? property;
    const merged = mergeScan(fresh.trackers, candidatesFrom(findings), { now: finishedAt, newId: () => id("trk", 6) });
    await store.updateProperty(propertyId, trackerPatch(fresh, merged.trackers));
    await store.appendAudit({
      orgId: fresh.orgId,
      actorUserId: null,
      actorEmail: "system:crawler",
      action: "tracker.scan_run",
      target: { type: "property", id: propertyId, label: fresh.domain.slice(0, 120) },
      metadata: { ok: true, engine: "headless", partial: result.timedOut, pages: loaded.length, findings: findings.length, added: merged.added.length, preConsent: preConsent.length },
      ipHash: "system",
      userAgent: "system",
    });
    log.info("Scan completed", { partial: result.timedOut, pages: loaded.length, findings: findings.length, added: merged.added.length, preConsent: preConsent.length });
    return "completed";
  } catch (e) {
    await writing.catch(() => undefined);
    log.error("Scan failed", { err: e });
    pushLine("error", `The scan failed: ${errorText(e)}`, null, e instanceof Error ? e.stack : undefined);
    await store
      .updateScan(propertyId, scanId, { status: "failed", finishedAt: new Date().toISOString(), error: "The scan failed. Try again.", progress, log: lines }, { ifStatus: ["running"] })
      .catch((err: unknown) => log.error("Could not record the failure", { err }));
    return "failed";
  } finally {
    ctx.signal.removeEventListener("abort", onShutdown);
    await browser?.close().catch(() => undefined);
  }
}

/** Claim and run in one call (local polling, CLI tools). */
export async function runScan(propertyId: string, scanId: string, ctx: JobContext, reclaim = false): Promise<JobOutcome> {
  const claimed = await claimScan(propertyId, scanId, ctx.config.workerId, reclaim);
  if (!claimed) return "skipped";
  return runClaimedScan(claimed, ctx);
}
