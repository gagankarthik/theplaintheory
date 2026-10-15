import "server-only";
import { recordAudit } from "./audit";
import { activeScan, crawlerMode, requestCrawl } from "./crawler";
import { id } from "./crypto";
import { rateLimiter } from "./rate-limit";
import { advanceSchedule, SCHEDULED_SCAN_BATCH } from "./scan-schedule";
import type { Store } from "./store/types";
import { candidatesFrom, mergeScan, trackerPatch } from "./trackers";
import type { Property } from "./types";

/**
 * The scheduled-scans job (daily, /api/internal/scheduled-scans). For each site whose schedule is
 * due it starts a scan through the same path as "Scan now" (lib/crawler requestCrawl), with the
 * same guards: one scan at a time per site (activeScan) and the per-site trackerScan rate limit.
 * Then it moves the site's nextDueAt on.
 *
 *  - a scan already running counts as this period's scan: skipped, schedule advanced
 *  - a suspended or missing organization: skipped, schedule advanced (no work for it)
 *  - rate limited: left due, so tomorrow's run tries again
 *
 * Headless modes only queue (fast). The fetch engine scans in-process (up to ~25 s each), so the
 * run stops starting new scans near its time budget; the rest stay due for the next run.
 */

export interface ScheduledScanOutcome {
  propertyId: string;
  result: "queued" | "scanned" | "failed" | "skipped_running" | "skipped_suspended" | "rate_limited" | "out_of_time" | "error";
  scanId?: string;
  nextDueAt?: string;
}

export interface ScheduledScanReport {
  ranAt: string;
  dryRun: boolean;
  due: number;
  outcomes: ScheduledScanOutcome[];
}

const BUDGET_MS = 240_000;
/** stop starting fetch-engine scans when less than this is left (one scan's worst case plus slack) */
const FETCH_SCAN_RESERVE_MS = 35_000;

export async function runScheduledScans(store: Store, opts: { dryRun?: boolean; now?: Date; limit?: number } = {}): Promise<ScheduledScanReport> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const ranAt = now.toISOString();
  const due = await store.listDueScanProperties(ranAt, opts.limit ?? SCHEDULED_SCAN_BATCH);
  const outcomes: ScheduledScanOutcome[] = [];
  if (opts.dryRun) {
    return { ranAt, dryRun: true, due: due.length, outcomes: due.map((p) => ({ propertyId: p.id, result: "queued", nextDueAt: p.scanSchedule?.nextDueAt })) };
  }
  const fetchMode = crawlerMode() === "fetch";

  const advance = async (p: Property) => {
    const next = advanceSchedule(p.scanSchedule!, new Date());
    await store.updateProperty(p.id, { scanSchedule: next });
    return next.nextDueAt;
  };

  for (const p of due) {
    if (!p.scanSchedule) continue;
    if (fetchMode && Date.now() - started > BUDGET_MS - FETCH_SCAN_RESERVE_MS) {
      outcomes.push({ propertyId: p.id, result: "out_of_time" });
      continue;
    }
    try {
      const org = await store.getOrg(p.orgId);
      if (!org || org.suspendedAt) {
        outcomes.push({ propertyId: p.id, result: "skipped_suspended", nextDueAt: await advance(p) });
        continue;
      }
      if (await activeScan(p.id)) {
        outcomes.push({ propertyId: p.id, result: "skipped_running", nextDueAt: await advance(p) });
        continue;
      }
      const limit = await rateLimiter("trackerScan").consume(p.id);
      if (!limit.ok) {
        outcomes.push({ propertyId: p.id, result: "rate_limited" });
        continue;
      }
      const report = await requestCrawl({ propertyId: p.id, domain: p.domain });
      let added = 0;
      // fetch scans finish here, so merge their findings like tracker-actions.ts does; headless
      // workers merge their own
      if (report.status === "ok" && report.engine !== "headless") {
        const fresh = await store.getProperty(p.id);
        if (fresh) {
          const merged = mergeScan(fresh.trackers, candidatesFrom(report.findings), { now: report.finishedAt, newId: () => id("trk", 6) });
          added = merged.added.length;
          await store.updateProperty(p.id, trackerPatch(fresh, merged.trackers));
        }
      }
      await recordAudit({
        orgId: p.orgId,
        actor: { system: "scan-schedule" },
        action: "tracker.scan_run",
        target: { type: "property", id: p.id, label: p.domain },
        metadata: { scheduled: true, frequency: p.scanSchedule.frequency, status: report.status, engine: report.engine ?? "fetch", added },
      });
      const result = report.status === "queued" ? "queued" : report.status === "ok" ? "scanned" : "failed";
      outcomes.push({ propertyId: p.id, result, scanId: report.id, nextDueAt: await advance(p) });
    } catch (e) {
      console.error("[scheduled-scans]", p.id, e);
      outcomes.push({ propertyId: p.id, result: "error" });
    }
  }
  return { ranAt, dryRun: false, due: due.length, outcomes };
}
