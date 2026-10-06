import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyAuditChain } from "@/lib/audit-chain";
import type { Store } from "@/lib/store/types";

/**
 * Next bundles route handlers and server actions separately, so the local store module can be
 * loaded more than once in one process. Two instances appending to the same trail must still
 * produce one unbroken chain (this forked before the store kept its lock on globalThis).
 */
describe("local store across module instances", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-store-"));
  let a: Store;
  let b: Store;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    a = (await import("@/lib/store/local")).localStore;
    vi.resetModules();
    b = (await import("@/lib/store/local")).localStore;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("loads two distinct instances", () => {
    expect(a).not.toBe(b);
  });

  it("interleaved appends from both instances form one contiguous chain", async () => {
    const draft = (n: number) => ({
      orgId: "org_x",
      actorUserId: "usr_1",
      actorEmail: "a@b.co",
      action: "banner.updated" as const,
      target: { type: "property", id: "p1" },
      metadata: { n },
      ipHash: "ip",
      userAgent: "ua",
    });
    await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).appendAudit(draft(i))));
    // and sequentially alternating, which is what forked in practice
    for (let i = 40; i < 50; i++) await (i % 2 ? a : b).appendAudit(draft(i));
    const events = await a.listAudit("org_x");
    expect(events).toHaveLength(50);
    expect(new Set(events.map((e) => e.seq)).size).toBe(50);
    expect(verifyAuditChain(events)).toMatchObject({ ok: true, checked: 50 });
  });
});
