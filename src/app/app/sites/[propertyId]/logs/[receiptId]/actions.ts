"use server";

import { failure } from "@/lib/action-result";
import { requireProperty } from "@/lib/auth/access";
import type { ReceiptVerification } from "@/lib/config-versions";
import { checkReceipt } from "@/lib/receipt-proof";

export type ReceiptCheck = ({ verification: ReceiptVerification; error?: undefined } | { verification?: undefined; error: string }) & { checkedAt: string };

/** Re-verify one receipt from what is stored now: its own hash, and its links to its neighbours. */
export async function verifyReceiptAction(propertyId: string, seq: number): Promise<ReceiptCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const { property, store } = await requireProperty(propertyId, "property:read");
    if (!Number.isSafeInteger(seq) || seq < 1) return { error: "That isn't a receipt number.", checkedAt };
    const found = await checkReceipt(store, property, seq);
    if (!found) return { error: `Receipt #${seq} is no longer stored for this site.`, checkedAt };
    return { verification: found.verification, checkedAt };
  } catch (e) {
    return { error: failure(e)?.error ?? "The check failed. Try again.", checkedAt };
  }
}
