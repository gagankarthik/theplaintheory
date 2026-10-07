import { GENESIS_HASH, hashReceipt, sha256 } from "./crypto";
import type { BannerCopy, BannerConfig, CategoryCopy, ConfigVersion, ConsentReceipt, Framework, NoticeTranslation, Property, RetentionCheckpoint, Tracker } from "./types";

/**
 * Proof of consent: immutable published-config snapshots and single-receipt verification.
 * Pure functions shared by both store drivers, the receipt page and the tests.
 */

/** JSON with object keys sorted at every level, so equal values always serialise to equal strings. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

export type ConfigVersionUnsigned = Omit<ConfigVersion, "hash">;

export const hashConfigVersion = (v: ConfigVersionUnsigned) =>
  sha256(canonicalJson({ propertyId: v.propertyId, version: v.version, config: v.config, trackers: v.trackers, publishedAt: v.publishedAt, publishedBy: v.publishedBy }));

export function buildConfigVersion(input: ConfigVersionUnsigned): ConfigVersion {
  const unsigned: ConfigVersionUnsigned = {
    propertyId: input.propertyId,
    version: input.version,
    config: input.config,
    trackers: input.trackers,
    publishedAt: input.publishedAt,
    publishedBy: input.publishedBy,
  };
  return { ...unsigned, hash: hashConfigVersion(unsigned) };
}

/** The stored hash still matches the snapshot's contents. */
export const configVersionIntact = (v: ConfigVersion) => hashConfigVersion(v) === v.hash;

/** Sort key for a version under the site's partition (CFGVER#000000000042). */
export const configVersionKey = (version: number) => `CFGVER#${String(version).padStart(12, "0")}`;

/** Where the notice for a receipt came from. */
export type SnapshotSource =
  | { kind: "snapshot"; version: ConfigVersion }
  /** published before snapshots were kept, but the live published config is still this version */
  | { kind: "live"; config: BannerConfig; trackers: Tracker[]; publishedAt?: string; version: number }
  | { kind: "missing"; version: number };

/**
 * Resolve the config a visitor saw under `version`: the immutable snapshot when one was kept, else the
 * site's current published config if it is still that version, else honestly nothing.
 */
export function resolveSnapshot(property: Pick<Property, "publishedVersion" | "publishedAt" | "published">, version: number, stored: ConfigVersion | null): SnapshotSource {
  if (stored && stored.version === version) return { kind: "snapshot", version: stored };
  if (property.published && property.publishedVersion === version && property.published.config.version === version) {
    return { kind: "live", config: property.published.config, trackers: property.published.trackers, publishedAt: property.publishedAt, version };
  }
  return { kind: "missing", version };
}

export interface NoticeShown {
  framework: Framework;
  /** the region rule actually used (the default notice when the receipt's region was off) */
  ruleFramework: Framework;
  language: string;
  translated: boolean;
  /** review state of the translation used, when one was */
  translationStatus?: NoticeTranslation["status"];
  copy: BannerCopy;
  categories: Pick<CategoryCopy, "id" | "label" | "description" | "required">[];
}

const base = (c: string) => c.toLowerCase().split("-")[0];

/** The notice text a receipt's visitor saw, mirroring how the SDK picks region and translation. */
export function noticeFor(config: BannerConfig, framework: Framework, language?: string): NoticeShown {
  const own = config.regions[framework];
  const ruleFramework: Framework = own?.enabled ? framework : "generic";
  const rule = config.regions[ruleFramework] ?? own;
  const translations = (rule.translations ?? {}) as Record<string, NoticeTranslation | undefined>;
  const code = language?.toLowerCase();
  // The SDK records the translation key it used, or the region's own language when it used the default copy.
  let key: string | undefined;
  if (code && translations[code]) key = code;
  else if (code && base(code) !== base(rule.language) && translations[base(code)]) key = base(code);
  const tr = key ? translations[key] : undefined;
  return {
    framework,
    ruleFramework,
    language: tr ? key! : rule.language,
    translated: Boolean(tr),
    ...(tr ? { translationStatus: tr.status } : {}),
    copy: tr?.copy ?? rule.copy,
    categories: config.categories.map((c) => ({ id: c.id, required: c.required, label: tr?.categories?.[c.id]?.label ?? c.label, description: tr?.categories?.[c.id]?.description ?? c.description })),
  };
}

export interface ReceiptVerification {
  ok: boolean;
  /** recomputing the hash from the stored fields gives the stored hash */
  hashOk: boolean;
  /** prevHash matches the receipt before it (or genesis / the retention checkpoint) */
  linkOk: boolean;
  /** what prevHash was checked against */
  linkedTo: "genesis" | "checkpoint" | "previous" | "unavailable";
  computedHash: string;
  expectedPrev: string | null;
  /** the receipt after this one stores this receipt's hash; null when this is the newest receipt */
  nextOk: boolean | null;
}

/**
 * Verify one receipt on its own: recompute its hash from the stored fields and check its link to the
 * receipt before it. `prev` is the receipt with seq - 1, or null when it isn't stored (first receipt,
 * removed by retention, or deleted). When `next` (seq + 1) is given, it must link back to this one.
 */
export function verifyReceipt(
  receipt: ConsentReceipt,
  prev: ConsentReceipt | null,
  checkpoint?: RetentionCheckpoint | null,
  next?: ConsentReceipt | null,
): ReceiptVerification {
  const { hash, ...rest } = receipt;
  const computedHash = hashReceipt(rest);
  const hashOk = computedHash === hash;
  let expectedPrev: string | null;
  let linkedTo: ReceiptVerification["linkedTo"];
  if (receipt.seq === 1) {
    expectedPrev = GENESIS_HASH;
    linkedTo = "genesis";
  } else if (prev && prev.seq === receipt.seq - 1) {
    expectedPrev = prev.hash;
    linkedTo = "previous";
  } else if (checkpoint && checkpoint.seq === receipt.seq - 1) {
    expectedPrev = checkpoint.hash;
    linkedTo = "checkpoint";
  } else {
    expectedPrev = null;
    linkedTo = "unavailable";
  }
  const linkOk = expectedPrev !== null && receipt.prevHash === expectedPrev;
  const nextOk = next && next.seq === receipt.seq + 1 ? next.prevHash === hash : null;
  return { ok: hashOk && linkOk && nextOk !== false, hashOk, linkOk, linkedTo, computedHash, expectedPrev, nextOk };
}
