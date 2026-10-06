import "server-only";
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
  const since = new Date(now.getTime() - days * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  // newest first
  const rows = await store.listReceipts(propertyId, { from: since.toISOString() });
  const byDay = new Map<string, DayAnchor>();
  for (const r of rows) {
    const day = r.timestamp.slice(0, 10);
    const a = byDay.get(day);
    if (!a) byDay.set(day, { day, seq: r.seq, hash: r.hash, receipts: 1 });
    else {
      a.receipts += 1;
      if (r.seq > a.seq) Object.assign(a, { seq: r.seq, hash: r.hash });
    }
  }
  const [latest] = rows.length ? rows : await store.listReceipts(propertyId, { limit: 1 });
  return {
    head: latest ? { seq: latest.seq, hash: latest.hash, timestamp: latest.timestamp } : null,
    anchors: [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day)),
  };
}
