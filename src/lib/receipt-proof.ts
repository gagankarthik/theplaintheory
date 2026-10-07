import "server-only";
import { verifyReceipt, type ReceiptVerification } from "./config-versions";
import type { Store } from "./store";
import type { ConsentReceipt, Property } from "./types";

/** A receipt's sequence number from the URL segment ("42"), or null when it isn't one. */
export function parseReceiptSeq(raw: string): number | null {
  if (!/^\d{1,12}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * Load one receipt of `property` with its neighbours and verify it: recompute its hash from the
 * stored fields, check it links to the receipt before it, and that the receipt after it links back.
 * Returns null when the site has no receipt with that number.
 */
export async function checkReceipt(
  store: Store,
  property: Pick<Property, "id" | "retentionCheckpoint">,
  seq: number,
): Promise<{ receipt: ConsentReceipt; verification: ReceiptVerification } | null> {
  const [receipt, prev, next] = await Promise.all([
    store.getReceipt(property.id, seq),
    seq > 1 ? store.getReceipt(property.id, seq - 1) : Promise.resolve(null),
    store.getReceipt(property.id, seq + 1),
  ]);
  // Receipts are keyed under their site, but never show one whose body names another site.
  if (!receipt || receipt.propertyId !== property.id) return null;
  return { receipt, verification: verifyReceipt(receipt, prev, property.retentionCheckpoint, next) };
}
