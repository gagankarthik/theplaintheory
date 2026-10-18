import type { ScanReport } from "./trackers";

/**
 * What a scan in flight is doing and roughly how long it has left, so the scanner and the setup
 * checklist can say "Starting a browser · about 2 min left" instead of an unexplained "Queued".
 *
 * Numbers are deliberately conservative: a worker starts from zero (Fargate cold start, usually
 * 40–90 s), then pages take a few seconds each. Once real pages come in, the measured rate wins.
 */

/** typical wait for a crawler worker to start and claim the scan */
export const WORKER_START_MS = 75_000;
/** assumed time per page until the crawl has measured its own */
export const PAGE_MS = 6_000;
/** after this long in the queue, say so plainly rather than keep counting down */
export const SLOW_QUEUE_MS = 3 * 60_000;

export type ScanPhase = "starting" | "crawling" | "finishing";

export interface ScanEta {
  phase: ScanPhase;
  elapsedMs: number;
  /** null when we can't say (e.g. waiting longer than usual) */
  remainingMs: number | null;
  pagesDone: number;
  pagesPlanned: number;
  /** waiting longer than usual for a worker */
  slow: boolean;
}

/** When the crawler claimed the scan: its "Crawler started." line (or a restart line). */
function crawlStartedAt(r: ScanReport): number | null {
  const line = r.log?.find((l) => /^Crawler started|^Restarted after/.test(l.message));
  return line ? Date.parse(line.at) : null;
}

export function scanEta(r: ScanReport, now = Date.now()): ScanEta {
  const started = Date.parse(r.startedAt);
  const elapsedMs = Math.max(0, now - started);
  const pagesDone = r.progress?.pagesScanned ?? r.pages.length;
  const planned = r.limits?.maxPages ?? 10;
  // the crawl stops early when the site has fewer linked pages than the limit
  const discovered = r.progress ? pagesDone + r.progress.pagesQueued : planned;
  const pagesPlanned = Math.max(1, Math.min(planned, Math.max(discovered, pagesDone)));

  if (r.status === "queued") {
    const slow = elapsedMs > SLOW_QUEUE_MS;
    const startLeft = Math.max(15_000, WORKER_START_MS - elapsedMs);
    // nothing is discovered yet (only the homepage is queued), so plan for the full page limit
    return { phase: "starting", elapsedMs, remainingMs: slow ? null : startLeft + planned * PAGE_MS, pagesDone: 0, pagesPlanned: planned, slow };
  }

  const crawlStart = crawlStartedAt(r) ?? started;
  const crawlMs = Math.max(0, now - crawlStart);
  const perPage = pagesDone > 0 ? Math.max(1_500, crawlMs / pagesDone) : PAGE_MS;
  const left = Math.max(0, pagesPlanned - pagesDone);
  if (left === 0) return { phase: "finishing", elapsedMs, remainingMs: 10_000, pagesDone, pagesPlanned, slow: false };
  return { phase: "crawling", elapsedMs, remainingMs: Math.round(left * perPage), pagesDone, pagesPlanned, slow: false };
}

/** "about 2 min left", "under a minute left" */
export function remainingLabel(ms: number | null) {
  if (ms === null) return null;
  if (ms < 60_000) return "under a minute left";
  return `about ${Math.round(ms / 60_000)} min left`;
}

/** "1:07" */
export function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const PHASE_LABEL: Record<ScanPhase, string> = {
  starting: "Starting a browser",
  crawling: "Visiting pages",
  finishing: "Sorting what it found",
};
