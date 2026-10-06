import { describe, expect, it } from "vitest";
import { AUDIT_GENESIS, canonicalAudit, hashAudit, verifyAuditChain } from "@/lib/audit-chain";
import { verifyChain } from "@/lib/crypto";
import type { AuditEvent } from "@/lib/types";
import { receipts } from "./helpers/receipts";

function auditEvents(n: number): AuditEvent[] {
  let prev = AUDIT_GENESIS;
  return Array.from({ length: n }, (_, i) => {
    const unsigned = {
      id: `aud_${i + 1}`,
      orgId: "org_1",
      seq: i + 1,
      actorUserId: "usr_1",
      actorEmail: "asha@acme.example",
      action: "banner.updated" as const,
      target: { type: "property", id: "prop_1", label: "shop.acme.example" },
      metadata: { version: i + 2 },
      ipHash: "ip",
      userAgent: "ua",
      createdAt: new Date(Date.parse("2026-10-01T00:00:00Z") + i * 60_000).toISOString(),
      prevHash: prev,
    };
    const e = { ...unsigned, hash: hashAudit(unsigned) };
    prev = e.hash;
    return e;
  });
}

describe("consent receipt chain", () => {
  it("verifies an intact chain from genesis", () => {
    const r = verifyChain(receipts(5));
    expect(r).toMatchObject({ ok: true, checked: 5 });
  });

  it("detects an edited receipt", () => {
    const list = receipts(5);
    list[2] = { ...list[2], action: "reject_all" };
    expect(verifyChain(list)).toMatchObject({ ok: false, brokenAt: 3 });
  });

  it("detects a deleted receipt in the middle", () => {
    const list = receipts(5);
    list.splice(2, 1);
    expect(verifyChain(list)).toMatchObject({ ok: false, brokenAt: 4 });
  });

  it("detects removal of the oldest receipts without a checkpoint", () => {
    expect(verifyChain(receipts(5).slice(2))).toMatchObject({ ok: false, brokenAt: 3 });
  });

  it("verifies from a retention checkpoint", () => {
    const list = receipts(6);
    const cp = { seq: list[2].seq, hash: list[2].hash };
    expect(verifyChain(list.slice(3), cp)).toMatchObject({ ok: true, checked: 3, head: list[5].hash });
  });

  it("ignores retired receipts left behind by an interrupted retention run", () => {
    const list = receipts(6);
    expect(verifyChain(list, { seq: 3, hash: list[2].hash })).toMatchObject({ ok: true, checked: 3 });
  });

  it("rejects a forged checkpoint", () => {
    const list = receipts(6);
    expect(verifyChain(list.slice(3), { seq: 3, hash: "f".repeat(64) })).toMatchObject({ ok: false, brokenAt: 4 });
  });

  it("an empty chain after a full purge verifies to the checkpoint", () => {
    expect(verifyChain([], { seq: 9, hash: "a".repeat(64) })).toEqual({ ok: true, checked: 0, head: "a".repeat(64) });
  });
});

describe("audit chain", () => {
  it("verifies an intact trail", () => {
    expect(verifyAuditChain(auditEvents(4))).toMatchObject({ ok: true, checked: 4 });
  });
  it("detects an edited actor", () => {
    const list = auditEvents(4);
    list[1] = { ...list[1], actorEmail: "someone-else@acme.example" };
    expect(verifyAuditChain(list)).toMatchObject({ ok: false, brokenAt: 2 });
  });
  it("detects edited metadata", () => {
    const list = auditEvents(4);
    list[3] = { ...list[3], metadata: { version: 99 } };
    expect(verifyAuditChain(list)).toMatchObject({ ok: false, brokenAt: 4 });
  });
  it("detects deletion of the first event", () => {
    expect(verifyAuditChain(auditEvents(4).slice(1))).toMatchObject({ ok: false, brokenAt: 2 });
  });
  it("detects deletion of the newest event only by the head moving back", () => {
    const list = auditEvents(4);
    const r = verifyAuditChain(list.slice(0, 3));
    expect(r.ok && r.head).toBe(list[2].hash);
  });
  it("serialises unambiguously: moving a separator between fields changes the hash", () => {
    const [e] = auditEvents(1);
    const a = { ...e, target: { ...e.target, label: "a|b" }, userAgent: "c" };
    const b = { ...e, target: { ...e.target, label: "a" }, userAgent: "b|c" };
    expect(canonicalAudit(a)).not.toBe(canonicalAudit(b));
  });
  it("is independent of metadata key order", () => {
    const [e] = auditEvents(1);
    expect(hashAudit({ ...e, metadata: { a: 1, b: 2 } })).toBe(hashAudit({ ...e, metadata: { b: 2, a: 1 } }));
  });
});
