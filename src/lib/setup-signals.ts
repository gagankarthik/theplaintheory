import "server-only";
import { rangeDays } from "@/lib/analytics";
import { STALE_SCAN_MS } from "@/lib/crawler";
import { PHASE_LABEL, remainingLabel, scanEta } from "@/lib/scan-eta";
import { evaluateFairness } from "@/lib/fairness";
import type { SetupSignals } from "@/lib/setup";
import type { Store } from "@/lib/store/types";
import { isScanActive, statusOf, type ScanReport } from "@/lib/trackers";
import type { Organization, Property } from "@/lib/types";

/**
 * Read what the setup checklist needs for one site: the latest scan, one receipt, and the last 90
 * days of page-view counters. Three small reads, so the layout can afford it for the site in focus.
 */
export async function loadSetupSignals(store: Store, property: Property, org: Pick<Organization, "dpo">): Promise<SetupSignals> {
  const days = rangeDays(90);
  const [[scan], receipts, counters] = await Promise.all([
    store.listScans(property.id, 1),
    store.listReceipts(property.id, { limit: 1 }),
    store.listCounters(property.id, days[0], days[days.length - 1]),
  ]);
  const decided = receipts.length > 0;
  return { ...base(property, org, scan, decided, counters.some((c) => c.views > 0)), scan: scanSignal(scan) };
}

/** The checklist's view of the latest scan: alive and in flight, failed, or nothing to say. */
export function scanSignal(scan: ScanReport | undefined, now = Date.now()): SetupSignals["scan"] {
  if (!scan) return undefined;
  if (isScanActive(scan)) {
    // same rule as the scanner: no activity for 15 minutes means the worker died
    const last = Date.parse(scan.log?.at(-1)?.at ?? scan.startedAt);
    if (now - last >= STALE_SCAN_MS) return { state: "failed", startedAt: scan.startedAt, error: "The scanner stopped responding" };
    const eta = scanEta(scan, now);
    return { state: "active", startedAt: scan.startedAt, phase: PHASE_LABEL[eta.phase], eta: remainingLabel(eta.remainingMs) };
  }
  if (scan.status === "failed") return { state: "failed", startedAt: scan.startedAt, error: scan.error };
  return undefined;
}

function base(property: Property, org: Pick<Organization, "dpo">, scan: ScanReport | undefined, decided: boolean, viewed: boolean): Omit<SetupSignals, "scan"> {
  return {
    propertyId: property.id,
    domain: property.domain,
    scanned: scan?.status === "ok",
    trackers: property.trackers.length,
    toReview: property.trackers.filter((t) => statusOf(t) === "review").length,
    bannerEdited: property.config.version > 1,
    published: property.publishedVersion > 0,
    blocked: evaluateFairness(property.config, { dpoEmail: org.dpo?.email }).failures.length,
    seen: decided || viewed,
    decided,
  };
}
