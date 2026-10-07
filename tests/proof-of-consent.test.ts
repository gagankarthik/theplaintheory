import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildConfigVersion,
  canonicalJson,
  configVersionIntact,
  hashConfigVersion,
  noticeFor,
  resolveSnapshot,
  verifyReceipt,
} from "@/lib/config-versions";
import { hashReceipt } from "@/lib/crypto";
import { defaultConfig } from "@/lib/defaults";
import type { Store } from "@/lib/store/types";
import type { BannerConfig, ConsentReceipt } from "@/lib/types";
import { receipts } from "./helpers/receipts";

const config = (version = 3): BannerConfig => ({ ...structuredClone(defaultConfig("shop.example")), version });
const snapshot = (version = 3, propertyId = "prop_1") =>
  buildConfigVersion({
    propertyId,
    version,
    config: config(version),
    trackers: [{ id: "trk_1", name: "Google Analytics", category: "analytics", pattern: "googletagmanager.com" }],
    publishedAt: "2026-10-01T09:00:00.000Z",
    publishedBy: "usr_1",
  });

describe("config version hash", () => {
  it("canonical JSON ignores key order and undefined fields", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(canonicalJson({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });

  it("is deterministic and commits to the content", () => {
    const a = snapshot();
    const b = snapshot();
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.hash).toBe(b.hash);
    // reordering keys inside the config doesn't change the hash
    const reordered = { ...a, config: Object.fromEntries(Object.entries(a.config).reverse()) as unknown as BannerConfig };
    expect(hashConfigVersion(reordered)).toBe(a.hash);
    expect(configVersionIntact(a)).toBe(true);
    // changing a word of the notice does
    const edited = structuredClone(a);
    edited.config.regions.gdpr.copy.title = "Something else";
    expect(hashConfigVersion(edited)).not.toBe(a.hash);
    expect(configVersionIntact(edited)).toBe(false);
  });
});

describe("local store config snapshots", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-cfgver-"));
  let store: Store;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes and reads a snapshot", async () => {
    const v = snapshot(3);
    expect(await store.saveConfigVersion(v)).toBe(true);
    expect(await store.getConfigVersion("prop_1", 3)).toEqual(v);
    expect(await store.getConfigVersion("prop_1", 4)).toBeNull();
    expect(await store.getConfigVersion("prop_other", 3)).toBeNull();
  });

  it("never overwrites an existing version", async () => {
    const original = await store.getConfigVersion("prop_1", 3);
    const forged = snapshot(3);
    forged.config.regions.gdpr.copy.title = "Rewritten later";
    forged.hash = hashConfigVersion(forged);
    expect(await store.saveConfigVersion(forged)).toBe(false);
    expect(await store.getConfigVersion("prop_1", 3)).toEqual(original);
  });

  it("returned snapshots can't be mutated in place", async () => {
    const got = (await store.getConfigVersion("prop_1", 3))!;
    got.config.regions.gdpr.copy.title = "Mutated";
    expect((await store.getConfigVersion("prop_1", 3))!.config.regions.gdpr.copy.title).not.toBe("Mutated");
  });

  it("lists newest version first and goes away with the site", async () => {
    await store.saveConfigVersion(snapshot(5));
    await store.saveConfigVersion(snapshot(4));
    await store.saveConfigVersion(snapshot(1, "prop_other"));
    expect((await store.listConfigVersions("prop_1", 10)).map((v) => v.version)).toEqual([5, 4, 3]);
    expect((await store.listConfigVersions("prop_1", 2)).map((v) => v.version)).toEqual([5, 4]);
    await store.deleteProperty("prop_1");
    expect(await store.listConfigVersions("prop_1", 10)).toEqual([]);
    expect(await store.listConfigVersions("prop_other", 10)).toHaveLength(1);
  });

  it("gets one receipt by sequence number", async () => {
    const draft = (n: number) => ({
      propertyId: "prop_r",
      visitorId: `${n}`.padStart(16, "a"),
      action: "accept_all" as const,
      framework: "gdpr" as const,
      categories: { essential: true, functional: true, analytics: true, marketing: true },
      country: "DE",
      device: "desktop" as const,
      browser: "Chrome",
      ipHash: "x",
      configVersion: 3,
      timestamp: new Date().toISOString(),
    });
    for (let i = 0; i < 3; i++) await store.appendReceipt(draft(i));
    const r2 = await store.getReceipt("prop_r", 2);
    expect(r2?.seq).toBe(2);
    expect(await store.getReceipt("prop_r", 9)).toBeNull();
    expect(await store.getReceipt("prop_1", 2)).toBeNull();
    const [r1, r3] = await Promise.all([store.getReceipt("prop_r", 1), store.getReceipt("prop_r", 3)]);
    expect(verifyReceipt(r2!, r1, null, r3)).toMatchObject({ ok: true, hashOk: true, linkOk: true, nextOk: true, linkedTo: "previous" });
  });
});

describe("resolveSnapshot", () => {
  const live = { publishedVersion: 7, publishedAt: "2026-09-01T00:00:00.000Z", published: { config: config(7), trackers: [] } };

  it("prefers the stored snapshot", () => {
    const v = snapshot(7);
    expect(resolveSnapshot(live, 7, v)).toEqual({ kind: "snapshot", version: v });
  });
  it("falls back to the live published config only when it is the same version", () => {
    expect(resolveSnapshot(live, 7, null).kind).toBe("live");
    expect(resolveSnapshot(live, 6, null)).toEqual({ kind: "missing", version: 6 });
    expect(resolveSnapshot({ publishedVersion: 0 }, 1, null).kind).toBe("missing");
  });
});

describe("noticeFor", () => {
  it("uses the region copy, a translation, or the default notice when the region was off", () => {
    const c = config();
    c.regions.dpdpa.translations = {
      hi: { copy: { ...c.regions.dpdpa.copy, title: "कुकी" }, categories: { analytics: { label: "विश्लेषण", description: "d" } }, status: "draft" },
    };
    expect(noticeFor(c, "gdpr", "en").copy.title).toBe(c.regions.gdpr.copy.title);
    const hi = noticeFor(c, "dpdpa", "hi-IN");
    expect(hi).toMatchObject({ translated: true, language: "hi", translationStatus: "draft" });
    expect(hi.copy.title).toBe("कुकी");
    expect(hi.categories.find((x) => x.id === "analytics")?.label).toBe("विश्लेषण");
    expect(noticeFor(c, "dpdpa", undefined)).toMatchObject({ translated: false, language: c.regions.dpdpa.language });
    c.regions.ccpa.enabled = false;
    expect(noticeFor(c, "ccpa", "en")).toMatchObject({ ruleFramework: "generic", copy: c.regions.generic.copy });
  });
});

describe("verifyReceipt", () => {
  const chain = receipts(4);

  it("passes for an untouched receipt with intact links", () => {
    expect(verifyReceipt(chain[0], null)).toMatchObject({ ok: true, linkedTo: "genesis", nextOk: null });
    expect(verifyReceipt(chain[1], chain[0], null, chain[2])).toMatchObject({ ok: true, linkedTo: "previous", nextOk: true });
    expect(verifyReceipt(chain[3], chain[2])).toMatchObject({ ok: true, nextOk: null });
  });

  it("fails when a stored field was edited", () => {
    const edited: ConsentReceipt = { ...chain[1], action: "reject_all" };
    expect(verifyReceipt(edited, chain[0])).toMatchObject({ ok: false, hashOk: false, linkOk: true });
  });

  it("fails when the receipt was re-hashed but its successor still points at the old hash", () => {
    const { hash: _old, ...rest } = { ...chain[1], action: "reject_all" as const };
    void _old;
    const rehashed = { ...rest, hash: hashReceipt(rest) } as ConsentReceipt;
    expect(verifyReceipt(rehashed, chain[0], null, chain[2])).toMatchObject({ ok: false, hashOk: true, linkOk: true, nextOk: false });
  });

  it("fails when the previous receipt is missing, unless retention left a checkpoint", () => {
    expect(verifyReceipt(chain[2], null)).toMatchObject({ ok: false, linkedTo: "unavailable" });
    const checkpoint = { seq: 2, hash: chain[1].hash, removedThrough: chain[1].timestamp, removedCount: 2, at: chain[1].timestamp };
    expect(verifyReceipt(chain[2], null, checkpoint)).toMatchObject({ ok: true, linkedTo: "checkpoint" });
  });
});
