import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsentReceipt } from "@/lib/types";

// anchorsFor reads through the store: give it receipts, and rollups with or without stored anchors
const state: { receipts: ConsentReceipt[]; anchors: boolean } = { receipts: [], anchors: true };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/store", () => ({
  getStore: async () => ({
    listReceipts: async (_p: string, q: { limit?: number; from?: string; to?: string } = {}) => {
      let rows = [...state.receipts].sort((a, b) => b.seq - a.seq);
      if (q.from) rows = rows.filter((r) => r.timestamp >= q.from!);
      if (q.to) rows = rows.filter((r) => r.timestamp <= q.to!);
      return q.limit ? rows.slice(0, q.limit) : rows;
    },
    listDecisionRollups: async () => {
      const { rollupsFromReceipts } = await import("@/lib/rollups");
      const rollups = rollupsFromReceipts(state.receipts).map((r) => (state.anchors ? r : { ...r, anchor: undefined }));
      return { rollups, fromSeq: 1 };
    },
  }),
}));

const NOW = new Date("2026-10-18T12:00:00Z");
const rcpt = (seq: number, day: string): ConsentReceipt =>
  ({ id: `r${seq}`, propertyId: "p", visitorId: `v${seq}`, action: "accept_all", framework: "gdpr", categories: { essential: true, functional: true, analytics: true, marketing: true }, country: "DE", device: "desktop", browser: "Chrome", ipHash: "x", configVersion: 1, timestamp: `${day}T10:00:00.000Z`, prevHash: "", hash: `h${seq}`, seq }) as ConsentReceipt;

beforeEach(() => {
  state.receipts = [rcpt(1, "2026-10-16"), rcpt(2, "2026-10-16"), rcpt(3, "2026-10-17"), rcpt(4, "2026-10-18"), rcpt(5, "2026-10-18"), rcpt(6, "2026-10-18")];
});

describe("anchorsFor", () => {
  it("anchors each day at its last receipt and counts receipts from consecutive seqs", async () => {
    state.anchors = true;
    const { anchorsFor } = await import("@/lib/anchors");
    const r = await anchorsFor("p", 30, NOW);
    expect(r.head?.seq).toBe(6);
    expect(r.anchors).toEqual([
      { day: "2026-10-18", seq: 6, hash: "h6", receipts: 3 },
      { day: "2026-10-17", seq: 3, hash: "h3", receipts: 1 },
      { day: "2026-10-16", seq: 2, hash: "h2", receipts: 2 },
    ]);
  });

  it("derives anchors from receipts for days rolled up before anchors were stored", async () => {
    state.anchors = false;
    const { anchorsFor } = await import("@/lib/anchors");
    const r = await anchorsFor("p", 30, NOW);
    expect(r.anchors.map((a) => [a.day, a.seq, a.receipts])).toEqual([
      ["2026-10-18", 6, 3],
      ["2026-10-17", 3, 1],
      ["2026-10-16", 2, 2],
    ]);
  });
});
