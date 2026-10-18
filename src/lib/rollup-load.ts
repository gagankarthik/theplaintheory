import "server-only";
import { mergeRollups, rollupsFromReceipts, type DecisionRollup } from "./rollups";
import type { Store } from "./store/types";

/**
 * Decision rollups for a site and day range: the stored daily counters, plus any receipts stored
 * before rollups existed (counted from the receipts, and only those: the read starts below
 * `fromSeq`). Pages read a few small items per day instead of every receipt; the legacy read fades
 * out as the window moves past the cut-over.
 */
export async function loadRollups(store: Store, propertyId: string, fromDay: string, toDay: string): Promise<DecisionRollup[]> {
  const rolled = await store.listDecisionRollups(propertyId, fromDay, toDay);
  if (rolled.fromSeq === 1) return rolled.rollups;
  const legacy = await store.listReceipts(propertyId, {
    from: `${fromDay}T00:00:00.000Z`,
    to: `${toDay}T23:59:59.999Z`,
    ...(rolled.fromSeq ? { before: rolled.fromSeq } : {}),
  });
  return mergeRollups(rolled.rollups, rollupsFromReceipts(legacy));
}
