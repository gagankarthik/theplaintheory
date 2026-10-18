import "server-only";
import { loadRollups } from "./rollup-load";
import { getStore } from "./store";

/**
 * Public chain anchors: for each UTC day, the sequence number and hash of the last receipt written
 * that day, plus the current head. Publishing these lets an auditor pin daily roots independently,
 * so a later rewrite of the log (by anyone, including us) would no longer match what was published.
 */

export interface DayAnchor {
  /** YYYY-MM-DD, UTC */
  day: string;
  seq: number;
  hash: string;
  /** receipts written that day */
  receipts: number;
}

export interface ChainAnchors {
  head: { seq: number; hash: string; timestamp: string } | null;
  anchors: DayAnchor[];
}

export async function anchorsFor(propertyId: string, days = 30, now = new Date()): Promise<ChainAnchors> {
  const store = await getStore();
  const day = (offset: number) => new Date(now.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
  // From the daily rollups, which keep each day's last receipt as it's written. A longer lookback
  // finds the anchor before the window, so the first day's receipt count is exact too.
  const [rollups, [latest]] = await Promise.all([loadRollups(store, propertyId, day(days + 60), day(0)), store.listReceipts(propertyId, { limit: 1 })]);
  const anchored = rollups.filter((r) => r.anchor).sort((a, b) => a.day.localeCompare(b.day));
  const windowStart = day(days);
  const anchors: DayAnchor[] = [];
  anchored.forEach((r, i) => {
    if (r.day < windowStart) return;
    const prev = anchored[i - 1]?.anchor?.seq;
    const receipts = prev !== undefined ? r.anchor!.seq - prev : r.accepted + r.partial + r.rejected + r.revoked;
    anchors.push({ day: r.day, seq: r.anchor!.seq, hash: r.anchor!.hash, receipts });
  });
  return {
    head: latest ? { seq: latest.seq, hash: latest.hash, timestamp: latest.timestamp } : null,
    anchors: anchors.sort((a, b) => b.day.localeCompare(a.day)),
  };
}
