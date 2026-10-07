import { createHash } from "node:crypto";
import type { PlatformAuditEvent } from "./types";

/** Pure hashing for the platform audit trail, shared by both store drivers and the tests. */
export const PLATFORM_AUDIT_GENESIS = "0".repeat(64);

export type PlatformAuditUnsigned = Omit<PlatformAuditEvent, "hash">;

export function canonicalPlatformAudit(e: PlatformAuditUnsigned) {
  const meta = e.metadata
    ? Object.keys(e.metadata)
        .sort()
        .map((k) => [k, e.metadata![k]])
    : [];
  return JSON.stringify([
    "platform",
    e.id,
    e.seq,
    e.actorUserId,
    e.actorEmail,
    e.actorRole,
    e.action,
    e.target.type,
    e.target.id,
    e.target.label ?? null,
    meta,
    e.ipHash,
    e.userAgent,
    e.createdAt,
    e.prevHash,
  ]);
}

export const hashPlatformAudit = (e: PlatformAuditUnsigned) => createHash("sha256").update(canonicalPlatformAudit(e)).digest("hex");

/** Verify the platform chain: contiguous sequence from 1, each event linked to the one before. */
export function verifyPlatformAuditChain(events: PlatformAuditEvent[]) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let prev = PLATFORM_AUDIT_GENESIS;
  let expected = 1;
  for (const e of sorted) {
    const { hash, ...rest } = e;
    if (e.seq !== expected || e.prevHash !== prev || hashPlatformAudit(rest) !== hash) return { ok: false as const, brokenAt: e.seq, checked: sorted.length };
    prev = hash;
    expected += 1;
  }
  return { ok: true as const, checked: sorted.length, head: prev };
}
