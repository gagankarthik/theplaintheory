import type { CategoryId, ConsentReceipt } from "./types";

const OPTIONAL: CategoryId[] = ["functional", "analytics", "marketing"];

/**
 * Withdrawals in a set of receipts: an explicit "revoke", or a visitor turning off a category their
 * previous receipt allowed (Accept all, then Reject all or a narrower custom choice). A first
 * decline is a refusal, not a withdrawal.
 */
export function countWithdrawals(receipts: Pick<ConsentReceipt, "visitorId" | "action" | "categories" | "timestamp">[]): number {
  const byVisitor = new Map<string, typeof receipts>();
  for (const r of receipts) byVisitor.set(r.visitorId, [...(byVisitor.get(r.visitorId) ?? []), r]);
  let n = 0;
  for (const list of byVisitor.values()) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    list.forEach((r, i) => {
      if (r.action === "revoke") return void n++;
      const prev = list[i - 1];
      if (prev && prev.action !== "revoke" && OPTIONAL.some((c) => prev.categories[c] && !r.categories[c])) n++;
    });
  }
  return n;
}
