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
  const [loaded, [latest]] = await Promise.all([loadRollups(store, propertyId, day(days + 60), day(0)), store.listReceipts(propertyId, { limit: 1 })]);
  // Days rolled up before rollups carried anchors have counts but no anchor: take those from the
  // day's receipts. Only the days from before the switch are read, and they leave the window in 30 days.
  const missing = loaded.filter((r) => !r.anchor && r.accepted + r.partial + r.rejected + r.revoked > 0).map((r) => r.day).sort();
  const derived = new Map<string, { seq: number; hash: string }>();
  if (missing.length) {
    for (const r of await store.listReceipts(propertyId, { from: `${missing[0]}T00:00:00.000Z`, to: `${missing[missing.length - 1]}T23:59:59.999Z` })) {
      const d = r.timestamp.slice(0, 10);
      const cur = derived.get(d);
      if (!cur || r.seq > cur.seq) derived.set(d, { seq: r.seq, hash: r.hash });
    }
  }
  const rollups = loaded.map((r) => (r.anchor || !derived.has(r.day) ? r : { ...r, anchor: derived.get(r.day)! }));
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
