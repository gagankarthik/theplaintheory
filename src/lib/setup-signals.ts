import "server-only";
import { rangeDays } from "@/lib/analytics";
import { evaluateFairness } from "@/lib/fairness";
import type { SetupSignals } from "@/lib/setup";
import type { Store } from "@/lib/store/types";
import { statusOf } from "@/lib/trackers";
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
  return {
    propertyId: property.id,
    domain: property.domain,
    scanned: scan?.status === "ok",
    trackers: property.trackers.length,
    toReview: property.trackers.filter((t) => statusOf(t) === "review").length,
    bannerEdited: property.config.version > 1,
    published: property.publishedVersion > 0,
    blocked: evaluateFairness(property.config, { dpoEmail: org.dpo?.email }).failures.length,
    seen: decided || counters.some((c) => c.views > 0),
    decided,
  };
}
