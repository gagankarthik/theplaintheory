import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hashIpWithSalt, ipHashSecret, ipRateKey, truncateIp, verifyChain } from "@/lib/crypto";
import { summarize, summarizeRollups } from "@/lib/analytics";
import { mergeRollups, rollupIncrement, rollupsFromReceipts } from "@/lib/rollups";
import { mergePolledLog, withLogAfter } from "@/lib/scan-poll";
import type { Store } from "@/lib/store/types";
import type { ScanReport } from "@/lib/trackers";
import type { ConsentReceipt } from "@/lib/types";

const dir = mkdtempSync(path.join(tmpdir(), "pt-salt-"));
let store: Store;

beforeAll(async () => {
  process.env.LOCAL_DATA_DIR = dir;
  delete process.env.STORE_DRIVER;
  store = (await import("@/lib/store/local")).localStore;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());

const noWithdrawn = <T extends { withdrawn?: number }>(r: T) => ({ ...r, withdrawn: undefined });

describe("IP hashing", () => {
  it("truncates before hashing, so one network shares a hash", () => {
    expect(truncateIp("203.0.113.77, 10.0.0.1")).toBe("203.0.113.0");
    expect(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::");
    expect(hashIpWithSalt("203.0.113.1", "s")).toBe(hashIpWithSalt("203.0.113.200", "s"));
    expect(hashIpWithSalt("203.0.113.1", "s")).not.toBe(hashIpWithSalt("203.0.113.1", "t"));
    expect(hashIpWithSalt(null, "s")).toBe("unknown");
  });

  it("rate-limit keys are stable and depend on the server secret", () => {
    vi.stubEnv("IP_HASH_SECRET", "secret-one");
    const a = ipRateKey("198.51.100.4");
    expect(ipRateKey("198.51.100.9")).toBe(a);
    vi.stubEnv("IP_HASH_SECRET", "secret-two");
    expect(ipRateKey("198.51.100.4")).not.toBe(a);
  });

  it("fails fast in production when no secret is set at all", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("IP_HASH_SECRET", "");
    expect(() => ipHashSecret()).toThrow(/IP_HASH_SECRET/);
    vi.stubEnv("IP_HASH_SECRET", "   ");
    expect(() => ipRateKey("198.51.100.4")).toThrow(/IP_HASH_SECRET/);
    vi.stubEnv("IP_HASH_SECRET", "set");
    expect(ipHashSecret()).toBe("set");
  });

  it("in production without IP_HASH_SECRET, derives a separate key from SESSION_SECRET instead of failing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IP_HASH_SECRET", "");
    vi.stubEnv("SESSION_SECRET", "a-session-secret-of-reasonable-length");
    const k = ipHashSecret();
    expect(k).toBeTruthy();
    expect(k).not.toContain("a-session-secret");
    expect(ipHashSecret()).toBe(k);
    expect(ipRateKey("198.51.100.4")).toBe(ipRateKey("198.51.100.9"));
    vi.stubEnv("SESSION_SECRET", "another-session-secret-value-here");
    expect(ipHashSecret()).not.toBe(k);
  });

  it("allows a dev secret only in development and test", () => {
    vi.stubEnv("IP_HASH_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(ipHashSecret()).toBeTruthy();
    vi.stubEnv("NODE_ENV", "development");
    expect(ipHashSecret()).toBeTruthy();
  });

  it("keeps one random salt per day in the store, the same for every caller", async () => {
    const [a, b] = await Promise.all([store.dailySalt("2026-10-16"), store.dailySalt("2026-10-16")]);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    const next = await store.dailySalt("2026-10-17");
    expect(next).not.toBe(a);
    // two days on, the first day's salt is gone and can't be recreated
    await store.dailySalt("2026-10-18");
    expect(await store.dailySalt("2026-10-16")).not.toBe(a);
  });

  it("stored hashes change with the day; rate keys don't", async () => {
    const { dailyIpHash, resetDailySaltCache } = await import("@/lib/ip-hash");
    resetDailySaltCache();
    const d1 = await dailyIpHash("192.0.2.10", new Date("2026-03-01T10:00:00Z"));
    expect(await dailyIpHash("192.0.2.99", new Date("2026-03-01T23:59:00Z"))).toBe(d1);
    expect(await dailyIpHash("192.0.2.10", new Date("2026-03-02T00:01:00Z"))).not.toBe(d1);
    expect(await dailyIpHash(null)).toBe("unknown");
  });

  it("receipt chains verify from the stored hash, never a recomputed one", async () => {
    const r1 = await store.appendReceipt(draft({ ipHash: "day-one-hash" }));
    const r2 = await store.appendReceipt(draft({ ipHash: "day-two-hash" }));
    expect(verifyChain([r1, r2]).ok).toBe(true);
  });
});

describe("public API rate limit", () => {
  it("counts hits per fixed window and resets in the next one", async () => {
    const { rateLimited } = await import("@/lib/public-api");
    const t0 = Date.parse("2026-05-05T10:00:00Z");
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimited("test:a", 3, 60_000, t0 + i));
    expect(results).toEqual([false, false, false, true]);
    expect(await rateLimited("test:b", 3, 60_000, t0)).toBe(false);
    expect(await rateLimited("test:a", 3, 60_000, t0 + 60_000)).toBe(false);
  });

  it("fails open when the store errors", async () => {
    vi.resetModules();
    vi.doMock("@/lib/store", () => ({ getStore: async () => ({ hitWindow: async () => Promise.reject(new Error("down")) }) }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rateLimited } = await import("@/lib/public-api");
    expect(await rateLimited("test:c", 0)).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    vi.doUnmock("@/lib/store");
    vi.resetModules();
  });
});

function draft(over: Partial<ConsentReceipt> = {}): Omit<ConsentReceipt, "id" | "seq" | "prevHash" | "hash"> {
  return {
    propertyId: "prop_roll",
    visitorId: "v_1",
    action: "accept_all",
    framework: "gdpr",
    categories: { essential: true, functional: true, analytics: true, marketing: true },
    country: "DE",
    device: "desktop",
    browser: "Chrome",
    ipHash: "x",
    configVersion: 1,
    timestamp: "2026-04-01T10:00:00.000Z",
    ...over,
  };
}

describe("daily decision rollups", () => {
  const mixed: Omit<ConsentReceipt, "id" | "seq" | "prevHash" | "hash">[] = [
    draft({ propertyId: "prop_mix" }),
    draft({ propertyId: "prop_mix", action: "reject_all", categories: { essential: true, functional: false, analytics: false, marketing: false }, gpc: true, country: "IN" }),
    draft({ propertyId: "prop_mix", action: "custom", categories: { essential: true, functional: true, analytics: true, marketing: false }, device: "mobile", timestamp: "2026-04-02T08:00:00.000Z" }),
    draft({ propertyId: "prop_mix", action: "revoke", timestamp: "2026-04-02T09:00:00.000Z" }),
    draft({ propertyId: "prop_mix", action: "dismiss", timestamp: "2026-04-02T09:30:00.000Z" }),
  ];

  it("encodes one receipt as flat counters for its UTC day", () => {
    const { day, fields } = rollupIncrement({ ...mixed[2] });
    expect(day).toBe("2026-04-02");
    expect(fields).toMatchObject({ "n:partial": 1, "g:functional": 1, "g:analytics": 1, "d:device:mobile:partial": 1, "d:framework:gdpr:partial": 1 });
    expect(fields["g:marketing"]).toBeUndefined();
    expect(rollupIncrement({ ...mixed[4] }).fields).toEqual({});
  });

  it("summaries from rollups match summaries from receipts", () => {
    const rows = mixed.map((d, i) => ({ ...d, id: `r${i}`, seq: i + 1, prevHash: "", hash: "" })) as ConsentReceipt[];
    const days = ["2026-04-01", "2026-04-02"];
    const fromReceipts = summarize(rows, [], days);
    const fromRollups = summarizeRollups(rollupsFromReceipts(rows), [], days);
    expect(fromRollups).toEqual(fromReceipts);
    expect(fromRollups).toMatchObject({ decisions: 3, accepted: 1, rejected: 1, partial: 1, revoked: 1, gpc: 1, granted: { functional: 2, analytics: 2, marketing: 1 } });
    expect(fromRollups.byCountry.map((r) => r.key)).toEqual(["DE", "IN"]);
  });

  it("the store keeps rollups as receipts are appended and marks where they start", async () => {
    const stored: ConsentReceipt[] = [];
    for (const d of mixed) stored.push(await store.appendReceipt(d));
    const range = await store.listDecisionRollups("prop_mix", "2026-04-01", "2026-04-30");
    expect(range.fromSeq).toBe(1);
    // Live withdrawals are added by the consent follow-up (not run here); everything else, anchors
    // included, matches a rebuild from the receipts.
    expect(range.rollups.map(noWithdrawn)).toEqual(rollupsFromReceipts(stored).map(noWithdrawn));
    const last = stored.at(-1)!;
    expect(range.rollups.find((r) => r.day === last.timestamp.slice(0, 10))?.anchor).toEqual({ seq: last.seq, hash: last.hash });
  });

  it("a visitor's receipts come back newest first, and a withdrawal can be added to the day", async () => {
    const v = mixed[0].visitorId;
    const mine = await store.listVisitorReceipts("prop_mix", v);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.visitorId === v)).toBe(true);
    expect(mine.map((r) => r.seq)).toEqual([...mine.map((r) => r.seq)].sort((a, b) => b - a));
    const [newest] = mine;
    expect(await store.listVisitorReceipts("prop_mix", v, { before: newest.seq, limit: 1 })).toEqual(mine.slice(1, 2));
    const day = newest.timestamp.slice(0, 10);
    const before = (await store.listDecisionRollups("prop_mix", day, day)).rollups[0]?.withdrawn ?? 0;
    await store.bumpRollup("prop_mix", day, { "n:withdrawn": 1 });
    expect((await store.listDecisionRollups("prop_mix", day, day)).rollups[0].withdrawn).toBe(before + 1);
  });

  it("legacy receipts plus rollups add up exactly on the cut-over day", () => {
    const rows = mixed.map((d, i) => ({ ...d, id: `r${i}`, seq: i + 1, prevHash: "", hash: "" })) as ConsentReceipt[];
    const legacy = rows.filter((r) => r.seq < 2);
    const rolled = rows.filter((r) => r.seq >= 2);
    // a withdrawal whose earlier receipt sits on the other side of the cut-over is counted live, not here
    expect(mergeRollups(rollupsFromReceipts(rolled), rollupsFromReceipts(legacy)).map(noWithdrawn)).toEqual(rollupsFromReceipts(rows).map(noWithdrawn));
  });

  it("rebuilding from receipts finds withdrawals: a visitor turning off a category they had allowed", () => {
    const at = (m: number) => `2026-05-01T10:0${m}:00.000Z`;
    const base = { framework: "gdpr" as const, country: "DE", device: "desktop" as const, browser: "Chrome", gpc: false };
    const all = { essential: true, functional: true, analytics: true, marketing: true };
    const none = { essential: true, functional: false, analytics: false, marketing: false };
    const [day] = rollupsFromReceipts([
      { ...base, visitorId: "a", action: "accept_all", categories: all, timestamp: at(1), seq: 1, hash: "h1" },
      { ...base, visitorId: "b", action: "reject_all", categories: none, timestamp: at(2), seq: 2, hash: "h2" },
      { ...base, visitorId: "a", action: "reject_all", categories: none, timestamp: at(3), seq: 3, hash: "h3" },
    ]);
    expect(day).toMatchObject({ accepted: 1, rejected: 2, withdrawn: 1, anchor: { seq: 3, hash: "h3" } });
  });
});

describe("scan polling", () => {
  const line = (n: number) => ({ at: `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`, level: "info" as const, message: `line ${n}` });
  const report = (lines: number[]) => ({ id: "scan_1", propertyId: "p", startedAt: "", finishedAt: "", status: "running", pages: [], findings: [], log: lines.map(line) }) as ScanReport;

  it("returns only lines after the cursor, or the whole log when the cursor is gone", () => {
    expect(withLogAfter(report([1, 2, 3]), { at: line(2).at, message: line(2).message })).toMatchObject({ logMode: "append", log: [line(3)] });
    expect(withLogAfter(report([5, 6]), { at: line(2).at, message: line(2).message })).toMatchObject({ logMode: "replace", log: [line(5), line(6)] });
    expect(withLogAfter(report([1]), null).logMode).toBe("replace");
  });

  it("merges appended lines and keeps the newest", () => {
    const polled = withLogAfter(report([1, 2, 3, 4]), { at: line(2).at, message: line(2).message });
    expect(mergePolledLog([line(1), line(2)], polled, 3)).toEqual([line(2), line(3), line(4)]);
  });

  it("the local store polls by id with the cursor", async () => {
    await store.saveScan(report([1, 2, 3]));
    const polled = await store.pollScan("p", "scan_1", { at: line(3).at, message: line(3).message });
    expect(polled).toMatchObject({ id: "scan_1", logMode: "append", log: [] });
    expect(await store.pollScan("p", "missing", null)).toBeNull();
  });
});
