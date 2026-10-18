import { describe, expect, it } from "vitest";
import { GENESIS_HASH, hashReceipt } from "@/lib/crypto";
import { chainCheckRecord, incrementalCheckFrom, ledgerPages, verifyLedger } from "@/lib/ledger";
import { runRetention } from "@/lib/retention";
import type { Store } from "@/lib/store/types";
import type { ConsentReceipt, Organization, Property } from "@/lib/types";

function chain(n: number): ConsentReceipt[] {
  const out: ConsentReceipt[] = [];
  let prev = GENESIS_HASH;
  for (let seq = 1; seq <= n; seq++) {
    const unsigned = {
      id: `r${seq}`,
      propertyId: "p",
      visitorId: `v${seq}`,
      action: "accept_all" as const,
      framework: "gdpr" as const,
      categories: { essential: true, functional: true, analytics: true, marketing: true },
      country: "DE",
      device: "desktop" as const,
      browser: "Chrome",
      ipHash: "x",
      configVersion: 1,
      timestamp: new Date(Date.UTC(2026, 9, 1) + seq * 60_000).toISOString(),
      prevHash: prev,
      seq,
    };
    const hash = hashReceipt(unsigned);
    out.push({ ...unsigned, hash });
    prev = hash;
  }
  return out;
}

/** Just enough store for the ledger: paging, and a count of how many receipts were read. */
function pagingStore(receipts: ConsentReceipt[]) {
  const stats = { read: 0 };
  const store = {
    async pageReceipts(_: string, afterSeq: number, limit: number) {
      const page = receipts.filter((r) => r.seq > afterSeq).slice(0, limit);
      stats.read += page.length;
      return page;
    },
  } as unknown as Store;
  return { store, stats };
}

describe("ledger paging and verification", () => {
  it("verifies across page boundaries and reports the head", async () => {
    const all = chain(25);
    const { store } = pagingStore(all);
    const pages: number[] = [];
    for await (const p of ledgerPages(store, "p", 0, 10)) pages.push(p.length);
    expect(pages).toEqual([10, 10, 5]);
    const r = await verifyLedger(store, "p", null);
    expect(r).toMatchObject({ ok: true, checked: 25, head: { seq: 25, hash: all[24].hash } });
  });

  it("finds a tampered receipt deep in the ledger and still hands every page on", async () => {
    const all = chain(2500);
    all[1700] = { ...all[1700], action: "reject_all" }; // seq 1701 altered after the fact
    const { store } = pagingStore(all);
    let seen = 0;
    const r = await verifyLedger(store, "p", null, (page) => void (seen += page.length));
    expect(r).toMatchObject({ ok: false, brokenAt: 1701, checked: 1700 });
    expect(seen).toBe(2500);
  });

  it("an incremental check reads only what was added since the last verified head", async () => {
    const all = chain(3000);
    const { store, stats } = pagingStore(all);
    const prop = { lastChainCheck: { at: "", ok: true, checked: 2900, head: { seq: 2900, hash: all[2899].hash } } } as Pick<Property, "retentionCheckpoint" | "lastChainCheck">;
    const r = await verifyLedger(store, "p", incrementalCheckFrom(prop));
    expect(r).toMatchObject({ ok: true, checked: 100, head: { seq: 3000 } });
    expect(stats.read).toBe(100);
    // the stored record counts the whole chain up to the head
    expect(chainCheckRecord({}, r, "now")).toMatchObject({ ok: true, checked: 3000, head: { seq: 3000 } });
  });
});

describe("retention at scale", () => {
  it("stops at the time budget and leaves the rest, least recently processed first, for the next run", async () => {
    const orgs = [
      { id: "o-new", name: "Never run", plan: "free" },
      { id: "o-old", name: "Ran last week", plan: "free", retentionLastRunAt: "2026-10-10T00:00:00.000Z" },
      { id: "o-recent", name: "Ran yesterday", plan: "free", retentionLastRunAt: "2026-10-17T00:00:00.000Z" },
    ] as Organization[];
    const store = {
      async listOrgs() {
        return orgs;
      },
      async listProperties() {
        // each organization takes a little while
        await new Promise((r) => setTimeout(r, 40));
        return [];
      },
      async appendAudit() {},
      async updateOrg() {},
    } as unknown as Store;
    const report = await runRetention(store, { now: new Date("2026-10-18T20:30:00Z"), budgetMs: 70 });
    expect(report.orgs.map((o) => o.orgId)).toEqual(["o-new", "o-old"]);
    expect(report.remaining).toBe(1);
  });
});
