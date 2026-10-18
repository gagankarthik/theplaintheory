import { verifyChain } from "./crypto";
import type { Store } from "./store/types";
import type { ConsentReceipt, Property } from "./types";

/**
 * Reading and verifying a site's consent ledger a page at a time, oldest first, so memory stays
 * flat however long the ledger is (exports, the audit report, evidence packs, chain checks and
 * retention all go through here; none of them hold the whole ledger).
 */

export const LEDGER_PAGE = 1000;

type Point = { seq: number; hash: string };

/** Receipts after `afterSeq`, oldest first, one page per iteration. */
export async function* ledgerPages(store: Store, propertyId: string, afterSeq = 0, pageSize = LEDGER_PAGE): AsyncGenerator<ConsentReceipt[]> {
  let after = afterSeq;
  for (;;) {
    const page = await store.pageReceipts(propertyId, after, pageSize);
    if (!page.length) return;
    yield page;
    after = page[page.length - 1].seq;
    if (page.length < pageSize) return;
  }
}

export type LedgerCheck = { ok: true; checked: number; head: Point | null } | { ok: false; checked: number; brokenAt: number; head: Point | null };

/**
 * Verify the chain from a known-good point (the retention checkpoint for a full check, or the last
 * verified head for an incremental one), handing every page to `onPage` as it goes. Pages keep
 * coming after a break (an export still lists every receipt); the first break is what's reported.
 */
export async function verifyLedger(store: Store, propertyId: string, from: Point | null, onPage?: (page: ConsentReceipt[]) => void | Promise<void>): Promise<LedgerCheck> {
  let carry: Point | null = from;
  let checked = 0;
  let brokenAt: number | null = null;
  for await (const page of ledgerPages(store, propertyId, from?.seq ?? 0)) {
    if (brokenAt === null) {
      const r = verifyChain(page, carry);
      if (!r.ok) {
        brokenAt = r.brokenAt;
        checked += page.filter((x) => x.seq < r.brokenAt).length;
      } else checked += page.length;
    }
    await onPage?.(page);
    const last = page[page.length - 1];
    carry = { seq: last.seq, hash: last.hash };
  }
  return brokenAt === null ? { ok: true, checked, head: carry } : { ok: false, checked, brokenAt, head: carry };
}

/** Where a full check starts: after receipts retired by retention. */
export const fullCheckFrom = (p: Pick<Property, "retentionCheckpoint">): Point | null => (p.retentionCheckpoint ? { seq: p.retentionCheckpoint.seq, hash: p.retentionCheckpoint.hash } : null);

/**
 * Where an incremental check starts: the last verified head, if it's still in the ledger (retention
 * may have retired past it), else the retention checkpoint. Everything before was already checked.
 */
export function incrementalCheckFrom(p: Pick<Property, "retentionCheckpoint" | "lastChainCheck">): Point | null {
  const cp = fullCheckFrom(p);
  const head = p.lastChainCheck?.ok ? p.lastChainCheck.head : undefined;
  return head && (!cp || head.seq > cp.seq) ? head : cp;
}

/** The stored result of a check: `checked` counts the whole chain up to the verified head. */
export function chainCheckRecord(p: Pick<Property, "retentionCheckpoint">, r: LedgerCheck, at: string) {
  const base = p.retentionCheckpoint?.seq ?? 0;
  return r.ok
    ? { at, ok: true, checked: Math.max(0, (r.head?.seq ?? base) - base), ...(r.head ? { head: r.head } : {}) }
    : { at, ok: false, checked: r.checked, brokenAt: r.brokenAt };
}
