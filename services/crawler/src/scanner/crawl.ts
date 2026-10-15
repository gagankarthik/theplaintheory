import type { Browser } from "puppeteer";
import { matchUrl, registrableDomain, sameSite } from "../app";
import { launchBrowser, realisticUserAgent } from "./browser";
import { capturePage, type PageCapture } from "./page-capture";
import { ALLOW_ALL, fetchRobots } from "./robots";
import type {
  CapturedCookie,
  CapturedRequestHost,
  CapturedStorageKey,
  PageResult,
  ScanOptions,
  ScanProgress,
  ScanResult,
} from "./types";
import { extractCrawlableLinks, normalizeUrl } from "./url";

const MAX_SEEN_URLS = 20;
const MAX_SAMPLES_PER_HOST = 25;

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/^\./, "").replace(/:\d+$/, "");
const isThirdParty = (host: string, siteHost: string) => !sameSite(normalizeHost(host), registrableDomain(normalizeHost(siteHost)));

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

function pushUrl(list: string[], url: string): void {
  if (list.length < MAX_SEEN_URLS && !list.includes(url)) list.push(url);
}

/** Accumulates observations across pages, de-duplicating by (name, domain, storage type). */
class FindingsAggregator {
  readonly cookies = new Map<string, CapturedCookie>();
  readonly storage = new Map<string, CapturedStorageKey>();
  readonly hosts = new Map<string, CapturedRequestHost & { types: Set<string> }>();

  constructor(public siteHost: string) {}

  addPage(pageUrl: string, capture: PageCapture): void {
    // Process the authoritative jar first so its attributes win over header/JS observations.
    const ordered = [...capture.cookies].sort((a, b) => rank(a.source) - rank(b.source));
    for (const c of ordered) {
      const domainKey = normalizeHost(c.domain);
      const key = `${c.name}|${domainKey}|COOKIE`;
      const existing = this.cookies.get(key) ?? this.findDocumentCookieMatch(c.name, c.source, domainKey);
      if (!existing) {
        this.cookies.set(key, {
          name: c.name,
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite,
          partitioned: c.partitioned,
          size: c.size,
          sources: [c.source],
          setByUrl: c.setByUrl,
          seenOnUrls: [pageUrl],
        });
        continue;
      }
      if (!existing.sources.includes(c.source)) existing.sources.push(c.source);
      pushUrl(existing.seenOnUrls, pageUrl);
      if (c.source !== "document.cookie") {
        // HttpOnly/Secure flags observed anywhere are real; expiry takes the latest known value.
        existing.httpOnly ||= c.httpOnly;
        existing.secure ||= c.secure;
        existing.partitioned ||= c.partitioned;
        existing.sameSite ??= c.sameSite;
        if (c.expires !== null) existing.expires = Math.max(existing.expires ?? 0, c.expires);
        existing.setByUrl ??= c.setByUrl;
        existing.size = Math.max(existing.size, c.size);
      }
    }

    for (const s of capture.storage) {
      const key = `${s.key}|${s.host}|${s.storageType}`;
      const existing = this.storage.get(key);
      if (existing) {
        pushUrl(existing.seenOnUrls, pageUrl);
        existing.valueLength = Math.max(existing.valueLength, s.valueLength);
      } else {
        this.storage.set(key, { ...s, seenOnUrls: [pageUrl] });
      }
    }

    for (const r of capture.requests) {
      let host: string;
      try {
        host = new URL(r.url).hostname.toLowerCase();
      } catch {
        continue;
      }
      const stripped = stripQuery(r.url);
      let entry = this.hosts.get(host);
      if (!entry) {
        entry = {
          host,
          requestCount: 0,
          resourceTypes: [],
          types: new Set(),
          sampleUrl: stripped,
          samples: [],
          pages: [],
          thirdParty: isThirdParty(host, this.siteHost),
        };
        this.hosts.set(host, entry);
      }
      entry.requestCount += 1;
      entry.types.add(r.resourceType);
      if (entry.samples.length < MAX_SAMPLES_PER_HOST && !entry.samples.some((x) => x.url === stripped && x.resourceType === r.resourceType)) {
        entry.samples.push({ url: stripped, resourceType: r.resourceType });
      }
      pushUrl(entry.pages, pageUrl);
    }
  }

  /** document.cookie only exposes names; attach it to a jar cookie with the same name on the site. */
  private findDocumentCookieMatch(name: string, source: string, domainKey: string): CapturedCookie | undefined {
    if (source !== "document.cookie") return undefined;
    for (const c of this.cookies.values()) {
      if (c.name === name && !isThirdParty(c.domain, domainKey)) return c;
    }
    return undefined;
  }

  /** Distinct known analytics/marketing products seen on the network so far. */
  trackerCount(): number {
    const ids = new Set<string>();
    for (const h of this.hosts.values()) {
      for (const sample of h.samples) {
        let u: URL;
        try {
          u = new URL(sample.url);
        } catch {
          continue;
        }
        const m = matchUrl(u);
        if (m && (m.def.category === "analytics" || m.def.category === "marketing")) ids.add(m.def.id);
      }
    }
    return ids.size;
  }

  requestHosts(): CapturedRequestHost[] {
    return [...this.hosts.values()].map(({ types, ...rest }) => ({ ...rest, resourceTypes: [...types].sort() }));
  }
}

function rank(source: string): number {
  return source === "cdp-jar" ? 0 : source === "set-cookie-header" ? 1 : 2;
}

function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Breadth-first crawl of a site as a first-time visitor who has NOT consented, returning every
 * cookie, storage key and outbound host observed. Database-independent so it can back both the
 * worker and the one-shot CLI.
 */
export async function scanSite(options: ScanOptions, existingBrowser?: Browser): Promise<ScanResult> {
  const startedAt = new Date().toISOString();
  const log = options.onLog ?? (() => undefined);
  const pageTimeoutMs = options.pageTimeoutMs ?? 30_000;
  const settleMs = options.settleMs ?? 1500;
  const pageDelayMs = options.pageDelayMs ?? 500;
  const maxPages = Math.max(1, options.maxPages);
  const maxDepth = Math.max(0, options.maxDepth);
  const deadline = options.deadlineMs ? Date.now() + Math.max(1, options.deadlineMs) : Number.POSITIVE_INFINITY;

  const startUrl = normalizeUrl(options.startUrl);
  if (!startUrl) throw new Error(`Invalid start URL: ${options.startUrl}`);

  const browser = existingBrowser ?? (await launchBrowser());
  const context = await browser.createBrowserContext();
  const userAgent = await realisticUserAgent(browser);

  const robots = options.respectRobots === false ? ALLOW_ALL : await fetchRobots(startUrl, userAgent, { guard: options.guard });
  if (robots.rules.length) log("DEBUG", `robots.txt loaded with ${robots.rules.length} rules`, startUrl);

  let siteHost = new URL(startUrl).hostname;
  let crawlRoot = startUrl;
  const aggregator = new FindingsAggregator(siteHost);
  const pages: PageResult[] = [];
  const skippedByRobots: string[] = [];
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  const seen = new Set<string>([startUrl]);
  let aborted = false;
  let timedOut = false;

  const progress = (): ScanProgress => ({
    pagesScanned: pages.length,
    pagesQueued: queue.length,
    cookiesFound: aggregator.cookies.size + aggregator.storage.size,
    trackersFound: aggregator.trackerCount(),
  });

  try {
    while (queue.length && pages.length < maxPages) {
      if (options.signal?.aborted) {
        aborted = true;
        log("WARN", "Scan aborted before completion", null, { pagesScanned: pages.length });
        break;
      }
      if (pages.length > 0 && Date.now() >= deadline) {
        timedOut = true;
        log("WARN", `Time limit reached after ${pages.length} page(s); stopping with ${queue.length} page(s) unvisited`, null, {
          pagesScanned: pages.length,
          deadlineMs: options.deadlineMs,
        });
        break;
      }
      const next = queue.shift()!;
      if (!robots.isAllowed(next.url)) {
        skippedByRobots.push(next.url);
        log("INFO", `Skipped by robots.txt: ${next.url}`, next.url);
        continue;
      }

      log("INFO", `Visiting ${next.url}`, next.url, { depth: next.depth });
      const t0 = Date.now();
      const cookiesBefore = aggregator.cookies.size + aggregator.storage.size;
      try {
        // Never let one page's load outlast the scan budget (the first page keeps its full timeout).
        const remaining = pages.length > 0 ? deadline - Date.now() : Number.POSITIVE_INFINITY;
        const timeoutMs = Math.max(1000, Math.min(pageTimeoutMs, remaining));
        const capture = await capturePage(context, next.url, { userAgent, timeoutMs, settleMs, guard: options.guard });
        for (const w of capture.warnings) log("WARN", w, next.url);
        if (capture.blocked.length) {
          log("WARN", `Blocked ${capture.blocked.length} request(s) to private or internal addresses`, next.url, { blocked: capture.blocked.slice(0, 10) });
        }

        // Redirects on the first page define the real site (e.g. apex → www).
        if (pages.length === 0 && capture.finalUrl && capture.finalUrl !== "about:blank") {
          const finalNormalized = normalizeUrl(capture.finalUrl);
          if (finalNormalized && finalNormalized !== startUrl) {
            log("INFO", `Start URL redirected to ${finalNormalized}`, next.url);
            crawlRoot = finalNormalized;
            siteHost = new URL(finalNormalized).hostname;
            aggregator.siteHost = siteHost;
            seen.add(finalNormalized);
          }
        }

        aggregator.addPage(capture.finalUrl || next.url, capture);
        options.onPage?.({ url: capture.finalUrl || next.url, html: capture.html, setCookies: capture.setCookieHeaders });
        const links = next.depth < maxDepth ? extractCrawlableLinks(capture.links, capture.finalUrl || next.url, crawlRoot) : [];
        for (const link of links) {
          if (seen.has(link)) continue;
          seen.add(link);
          queue.push({ url: link, depth: next.depth + 1 });
        }

        const found = aggregator.cookies.size + aggregator.storage.size;
        pages.push({
          url: next.url,
          finalUrl: capture.finalUrl,
          depth: next.depth,
          status: capture.status,
          title: capture.title,
          ok: capture.status === null || capture.status < 400,
          error: null,
          durationMs: Date.now() - t0,
          cookiesSeen: capture.cookies.length + capture.storage.length,
          requestsSeen: capture.requests.length,
          linksFound: links.length,
        });
        if (capture.status !== null && capture.status >= 400) {
          log("WARN", `HTTP ${capture.status} for ${next.url}`, next.url);
        }
        log("INFO", `Found ${found} cookies and storage keys (${found - cookiesBefore} new) after ${next.url}`, next.url, {
          requests: capture.requests.length,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        pages.push({
          url: next.url,
          finalUrl: next.url,
          depth: next.depth,
          status: null,
          title: null,
          ok: false,
          error: errorMessage(err),
          durationMs: Date.now() - t0,
          cookiesSeen: 0,
          requestsSeen: 0,
          linksFound: 0,
        });
        log("ERROR", `Failed to load ${next.url}: ${errorMessage(err)}`, next.url, {
          stack: err instanceof Error ? err.stack : undefined,
        });
      }

      options.onProgress?.(progress());
      if (queue.length && pages.length < maxPages) await sleep(pageDelayMs, options.signal);
    }
  } finally {
    await context.close().catch(() => undefined);
    if (!existingBrowser) await browser.close().catch(() => undefined);
  }

  options.onProgress?.(progress());

  return {
    startUrl: crawlRoot,
    siteHost,
    startedAt,
    finishedAt: new Date().toISOString(),
    aborted,
    timedOut,
    pages,
    cookies: [...aggregator.cookies.values()],
    storage: [...aggregator.storage.values()],
    requestHosts: aggregator.requestHosts(),
    skippedByRobots,
    userAgent,
  };
}
