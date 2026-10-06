import { describe, expect, it } from "vitest";
import { AUDIT_GENESIS, hashAudit, verifyAuditChain } from "@/lib/audit-chain";
import { verifyChain } from "@/lib/crypto";
import { runRetention } from "@/lib/retention";
import type { AuditDraft, Store } from "@/lib/store/types";
import type { AuditEvent, ConsentReceipt, LeakReport, Organization, Property, WebhookDelivery } from "@/lib/types";
import { receipts } from "./helpers/receipts";

const NOW = new Date("2026-10-06T12:00:00Z");
const DAY = 86_400_000;

/** Just enough of the Store for the retention job, in memory. */
function memoryStore(init: { org: Organization; property: Property; receipts: ConsentReceipt[]; leaks?: LeakReport[]; deliveries?: WebhookDelivery[] }) {
  const state = {
    org: { ...init.org },
    property: { ...init.property },
    receipts: [...init.receipts],
    leaks: [...(init.leaks ?? [])],
    deliveries: [...(init.deliveries ?? [])],
    audit: [] as AuditEvent[],
    calls: [] as string[],
  };
  const store = {
    async listOrgs() {
      return [state.org];
    },
    async listProperties() {
      return [state.property];
    },
    async listReceipts() {
      return [...state.receipts].reverse();
    },
    async updateProperty(_: string, patch: Partial<Property>) {
      state.calls.push("updateProperty");
      state.property = { ...state.property, ...patch };
      return state.property;
    },
    async deleteReceiptsThrough(_: string, seq: number) {
      state.calls.push("deleteReceiptsThrough");
      const before = state.receipts.length;
      state.receipts = state.receipts.filter((r) => r.seq > seq);
      return before - state.receipts.length;
    },
    async listLeaks(_: string, since: string) {
      return state.leaks.filter((l) => l.createdAt >= since);
    },
    async pruneLeaks(_: string, before: string) {
      const n = state.leaks.length;
      state.leaks = state.leaks.filter((l) => l.createdAt >= before);
      return n - state.leaks.length;
    },
    async listWebhookDeliveries() {
      return [...state.deliveries];
    },
    async pruneWebhookDeliveries(_: string, before: string) {
      const n = state.deliveries.length;
      state.deliveries = state.deliveries.filter((d) => d.createdAt >= before);
      return n - state.deliveries.length;
    },
    async appendAudit(d: AuditDraft) {
      const prev = state.audit.at(-1);
      const unsigned = { ...d, id: `aud_${state.audit.length + 1}`, seq: state.audit.length + 1, createdAt: d.createdAt ?? NOW.toISOString(), prevHash: prev?.hash ?? AUDIT_GENESIS };
      const e = { ...unsigned, hash: hashAudit(unsigned) } as AuditEvent;
      state.audit.push(e);
      return e;
    },
    async updateOrg(_: string, patch: Partial<Organization>) {
      state.org = { ...state.org, ...patch };
      return state.org;
    },
  };
  return { store: store as unknown as Store, state };
}

const org = { id: "org_1", name: "Northwind", plan: "free", dataRegion: "ap-south-1", createdAt: "2026-01-01T00:00:00Z" } as Organization;
const property = { id: "prop_1", orgId: "org_1", name: "Demo", domain: "demo.example" } as Property;
// 120 daily receipts ending today; the Free plan keeps 90 days.
// half a day off the boundary, so exactly 30 are past the cutoff (a receipt exactly 90 days old is kept)
const start = NOW.getTime() - 119.5 * DAY;
const fixture = () => {
  const list = receipts(120, 1, undefined, start);
  return list.map((r) => ({ ...r, propertyId: property.id }));
};

describe("retention", () => {
  it("dry run reports what would be removed and changes nothing", async () => {
    const { store, state } = memoryStore({ org, property, receipts: fixture() });
    const report = await runRetention(store, { dryRun: true, now: NOW });
    const p = report.orgs[0].properties[0];
    expect(report.dryRun).toBe(true);
    expect(p.receiptsRemoved).toBe(30);
    expect(state.receipts).toHaveLength(120);
    expect(state.property.retentionCheckpoint).toBeUndefined();
    expect(state.audit).toHaveLength(0);
  });

  it("removes receipts past the plan's retention and leaves a verifiable checkpoint", async () => {
    const all = fixture();
    const { store, state } = memoryStore({ org, property, receipts: all });
    const report = await runRetention(store, { now: NOW });
    const cp = state.property.retentionCheckpoint!;
    expect(report.totals.receiptsRemoved).toBe(30);
    expect(state.receipts).toHaveLength(90);
    expect(cp).toMatchObject({ seq: 30, hash: all[29].hash, removedCount: 30 });
    expect(cp.removedThrough < new Date(NOW.getTime() - 90 * DAY).toISOString()).toBe(true);
    // checkpoint is written before anything is deleted
    expect(state.calls).toEqual(["updateProperty", "deleteReceiptsThrough"]);
    expect(verifyChain(state.receipts, cp)).toMatchObject({ ok: true, checked: 90 });
    // without the checkpoint the trimmed chain would look tampered with
    expect(verifyChain(state.receipts).ok).toBe(false);
  });

  it("is idempotent and accumulates the removed count across runs", async () => {
    const { store, state } = memoryStore({ org, property, receipts: fixture() });
    await runRetention(store, { now: NOW });
    const again = await runRetention(store, { now: NOW });
    expect(again.totals.receiptsRemoved).toBe(0);
    await runRetention(store, { now: new Date(NOW.getTime() + 5 * DAY) });
    expect(state.property.retentionCheckpoint).toMatchObject({ seq: 35, removedCount: 35 });
    expect(verifyChain(state.receipts, state.property.retentionCheckpoint)).toMatchObject({ ok: true, checked: 85 });
  });

  it("leaves a tampered chain untouched and reports it", async () => {
    const list = fixture();
    list[50] = { ...list[50], action: "reject_all" };
    const { store, state } = memoryStore({ org, property, receipts: list });
    const report = await runRetention(store, { now: NOW });
    expect(report.orgs[0].properties[0].skipped).toBe("chain-broken");
    expect(report.totals.propertiesSkipped).toBe(1);
    expect(state.receipts).toHaveLength(120);
  });

  it("prunes old leak reports and webhook logs, and records the run in the audit trail", async () => {
    const at = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
    const leaks = [100, 95, 10].map((d, i) => ({ id: `leak_${i}`, propertyId: property.id, createdAt: at(d) }) as LeakReport);
    const deliveries = [45, 31, 2].map((d, i) => ({ id: `dlv_${i}`, propertyId: property.id, createdAt: at(d) }) as WebhookDelivery);
    const { store, state } = memoryStore({ org, property, receipts: fixture(), leaks, deliveries });
    const report = await runRetention(store, { now: NOW });
    expect(report.totals).toMatchObject({ leaksRemoved: 2, deliveriesRemoved: 2 });
    expect(state.leaks).toHaveLength(1);
    expect(state.deliveries).toHaveLength(1);
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]).toMatchObject({ action: "retention.run", actorUserId: null, actorEmail: "system:retention" });
    expect(state.audit[0].metadata).toMatchObject({ receiptsRemoved: 30, leaksRemoved: 2, deliveriesRemoved: 2 });
    expect(verifyAuditChain(state.audit).ok).toBe(true);
    expect(state.org.retentionLastRunAt).toBe(NOW.toISOString());
  });
});
