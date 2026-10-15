import "server-only";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { awsClientConfig } from "../aws";
import { id } from "../crypto";
import { runTrackerScan } from "../scan";
import { getStore } from "../store";
import { isScanActive, type ScanReport } from "../trackers";

/**
 * Tracker crawls: one entry point for the dashboard, whichever engine runs the scan.
 *
 * Contract (stable; the dashboard builds on it):
 *  - crawlerMode(): which engine runs.
 *      "headless-sqs"   CRAWLER_QUEUE_URL is set: a queued ScanReport is stored and a message goes to
 *                       SQS; the Fargate crawler (services/crawler) runs real Chromium and updates the
 *                       report as it goes (status queued → running → ok/failed, progress, log).
 *      "headless-local" CRAWLER_MODE=local: same, but the local worker (`npm run dev` in
 *                       services/crawler) polls the file store for queued reports instead of SQS.
 *      "fetch"          otherwise: the in-process server-HTML scan (lib/scan.ts) runs synchronously.
 *  - requestCrawl(input): returns the stored report. Headless modes return it queued (poll it with
 *      getScan until isScanActive(report) is false); fetch mode returns it finished.
 *      Never throws for site problems; throws only for store/queue failures.
 *  - cancelCrawl(propertyId, scanId): queued/running → cancelled. The worker stops at its next page.
 *  - getScan(propertyId, scanId), activeScan(propertyId): reads.
 * Callers must check permissions first (tracker-actions.ts does); nothing here authorises.
 * Merging findings into the tracker list is done by whoever finishes the scan: the dashboard for
 * fetch scans (tracker-actions.ts), the worker for headless ones.
 */

export type CrawlerMode = "headless-sqs" | "headless-local" | "fetch";

/** Defaults and caps for headless crawls. */
export const CRAWL_LIMITS = { defaultPages: 25, maxPages: 100, defaultDepth: 2, maxDepth: 4 };

export function crawlerMode(): CrawlerMode {
  if (process.env.CRAWLER_QUEUE_URL) return "headless-sqs";
  if (process.env.CRAWLER_MODE === "local") return "headless-local";
  return "fetch";
}

/** Message body on the crawl queue (services/crawler reads the same shape). */
export interface CrawlMessage {
  type: "CRAWL";
  propertyId: string;
  scanId: string;
}

let sqs: SQSClient | undefined;
const sqsClient = () => (sqs ??= new SQSClient(awsClientConfig));

export interface CrawlRequest {
  propertyId: string;
  domain: string;
  runBy?: string;
  maxPages?: number;
  maxDepth?: number;
}

const clamp = (v: number | undefined, fallback: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(1, Math.floor(v as number))) : fallback;

export async function requestCrawl(input: CrawlRequest): Promise<ScanReport> {
  const store = await getStore();
  const mode = crawlerMode();

  if (mode === "fetch") {
    const report: ScanReport = { ...(await runTrackerScan(input)), engine: "fetch" };
    await store.saveScan(report);
    return report;
  }

  const limits = {
    maxPages: clamp(input.maxPages, CRAWL_LIMITS.defaultPages, CRAWL_LIMITS.maxPages),
    maxDepth: clamp(input.maxDepth, CRAWL_LIMITS.defaultDepth, CRAWL_LIMITS.maxDepth),
  };
  const now = new Date().toISOString();
  const report: ScanReport = {
    id: id("scan", 8),
    propertyId: input.propertyId,
    startedAt: now,
    finishedAt: "",
    status: "queued",
    engine: "headless",
    pages: [],
    findings: [],
    limits,
    progress: { pagesScanned: 0, pagesQueued: 1, findings: 0 },
    log: [{ at: now, level: "info", message: `Queued: up to ${limits.maxPages} pages, ${limits.maxDepth} links deep.` }],
    ...(input.runBy ? { runBy: input.runBy } : {}),
  };
  await store.saveScan(report);

  if (mode === "headless-sqs") {
    const body: CrawlMessage = { type: "CRAWL", propertyId: input.propertyId, scanId: report.id };
    try {
      await sqsClient().send(new SendMessageCommand({ QueueUrl: process.env.CRAWLER_QUEUE_URL, MessageBody: JSON.stringify(body) }));
    } catch (e) {
      const failed = await store.updateScan(input.propertyId, report.id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: "The scan couldn't be queued. Try again in a minute.",
      });
      console.error("[crawler] enqueue failed", e);
      return failed ?? report;
    }
  }
  return report;
}

export async function cancelCrawl(propertyId: string, scanId: string): Promise<ScanReport | null> {
  const store = await getStore();
  const now = new Date().toISOString();
  const current = await store.getScan(propertyId, scanId);
  if (!current || !isScanActive(current)) return null;
  return store.updateScan(
    propertyId,
    scanId,
    { status: "cancelled", finishedAt: now, log: [...(current.log ?? []), { at: now, level: "warn", message: "Cancelled." }] },
    { ifStatus: ["queued", "running"] },
  );
}

export async function getScan(propertyId: string, scanId: string): Promise<ScanReport | null> {
  return (await getStore()).getScan(propertyId, scanId);
}

/**
 * A crawl whose newest log line is older than this is treated as dead (worker crashed without
 * handing it back). The worker writes progress at least once per page, and pages time out at 30 s.
 */
export const STALE_SCAN_MS = 15 * 60_000;

const lastActivity = (r: ScanReport) => Date.parse(r.log?.at(-1)?.at ?? r.startedAt);

/**
 * The newest queued or running scan for a site, if any. A stale one is marked failed on the way,
 * so a crashed worker never blocks the site's next scan.
 */
export async function activeScan(propertyId: string): Promise<ScanReport | null> {
  const store = await getStore();
  const recent = await store.listScans(propertyId, 5);
  for (const r of recent.filter(isScanActive)) {
    if (Date.now() - lastActivity(r) < STALE_SCAN_MS) return r;
    const now = new Date().toISOString();
    await store.updateScan(
      propertyId,
      r.id,
      {
        status: "failed",
        finishedAt: now,
        error: "The crawler stopped responding. Run the scan again.",
        log: [...(r.log ?? []), { at: now, level: "error", message: "No progress for 15 minutes; marked as failed." }],
      },
      { ifStatus: [r.status] },
    );
  }
  return null;
}
