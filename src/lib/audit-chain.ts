import { createHash } from "node:crypto";
import type { AuditEvent } from "./types";

/**
 * Pure hashing for the administrative audit trail. Shared by both store drivers, the verifier and the
 * tests. Same construction as consent receipts: each event commits to the previous event's hash.
 */
export const AUDIT_GENESIS = "0".repeat(64);

export type AuditUnsigned = Omit<AuditEvent, "hash">;

/** Stable, unambiguous serialisation: a JSON array in fixed field order, metadata as sorted pairs. */
export function canonicalAudit(e: AuditUnsigned) {
  const meta = e.metadata
    ? Object.keys(e.metadata)
        .sort()
        .map((k) => [k, e.metadata![k]])
    : [];
  return JSON.stringify([
    e.id,
    e.orgId,
    e.seq,
    e.actorUserId,
    e.actorEmail,
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

export const hashAudit = (e: AuditUnsigned) => createHash("sha256").update(canonicalAudit(e)).digest("hex");

/**
 * Verify an organization's audit chain in sequence order. Sequence numbers must be contiguous from 1
 * and each event must link to the one before it, so removed events are detected as well as edits.
 */
export function verifyAuditChain(events: AuditEvent[]) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let prev = AUDIT_GENESIS;
  let expectedSeq = 1;
  for (const e of sorted) {
    const { hash, ...rest } = e;
    if (e.seq !== expectedSeq || e.prevHash !== prev || hashAudit(rest) !== hash) {
      return { ok: false as const, brokenAt: e.seq, checked: sorted.length };
    }
    prev = hash;
    expectedSeq += 1;
  }
  return { ok: true as const, checked: sorted.length, head: prev };
}
