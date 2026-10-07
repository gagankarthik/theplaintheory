import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canPlatform, PLATFORM_ROLES } from "@/lib/auth/platform";
import { activeGrace, effectivePlanForRecords, effectiveRetentionDays, planChange, RETENTION_GRACE_DAYS } from "@/lib/retention-grace";
import type { Store } from "@/lib/store/types";
import type { Organization, PlanId } from "@/lib/types";

const NOW = new Date("2026-10-06T12:00:00Z");
const DAY = 86_400_000;
const in30 = new Date(NOW.getTime() + RETENTION_GRACE_DAYS * DAY).toISOString();

describe("retention grace rules", () => {
  it("a cancellation keeps the old plan's retention and features for 30 days", () => {
    const c = planChange({ plan: "business" }, "free", NOW);
    expect(c.graceStarted).toEqual({ until: in30, logRetentionDays: 2555, fromPlan: "business" });
    const after = { plan: "free" as PlanId, ...c.patch };
    expect(effectiveRetentionDays(after, NOW)).toBe(2555);
    expect(effectivePlanForRecords(after, NOW).id).toBe("business");
    expect(effectivePlanForRecords(after, NOW).limits.evidencePack).toBe(true);
    // the day after it ends, the Free plan applies
    const later = new Date(NOW.getTime() + 31 * DAY);
    expect(activeGrace(after, later)).toBeNull();
    expect(effectiveRetentionDays(after, later)).toBe(90);
    expect(effectivePlanForRecords(after, later).id).toBe("free");
  });

  it("a downgrade to shorter retention starts a grace; one to the same or longer doesn't", () => {
    expect(planChange({ plan: "business" }, "growth", NOW).graceStarted).toMatchObject({ logRetentionDays: 2555, fromPlan: "business" });
    expect(planChange({ plan: "growth" }, "business", NOW)).toEqual({ patch: {}, graceStarted: null, graceCleared: false });
    expect(planChange({ plan: "free" }, "free", NOW)).toEqual({ patch: {}, graceStarted: null, graceCleared: false });
  });

  it("a second drop during a grace keeps the longest window and restarts the 30 days", () => {
    const g = { until: new Date(NOW.getTime() + 5 * DAY).toISOString(), logRetentionDays: 2555, fromPlan: "business" as PlanId };
    const c = planChange({ plan: "growth", retentionGrace: g }, "free", NOW);
    expect(c.graceStarted).toEqual({ until: in30, logRetentionDays: 2555, fromPlan: "business" });
  });

  it("upgrading back clears the grace; a partial upgrade keeps it", () => {
    const g = { until: in30, logRetentionDays: 2555, fromPlan: "business" as PlanId };
    expect(planChange({ plan: "free", retentionGrace: g }, "business", NOW)).toMatchObject({ patch: { retentionGrace: undefined }, graceCleared: true });
    expect("retentionGrace" in planChange({ plan: "free", retentionGrace: g }, "business", NOW).patch).toBe(true);
    // Starter keeps a year, less than the grace's seven: the grace stays until it ends
    expect(planChange({ plan: "free", retentionGrace: g }, "starter", NOW)).toEqual({ patch: {}, graceStarted: null, graceCleared: false });
  });

  it("an expired grace never extends retention", () => {
    const g = { until: new Date(NOW.getTime() - DAY).toISOString(), logRetentionDays: 730, fromPlan: "growth" as PlanId };
    expect(effectiveRetentionDays({ plan: "free", retentionGrace: g }, NOW)).toBe(90);
    expect(effectivePlanForRecords({ plan: "free", retentionGrace: g }, NOW).id).toBe("free");
  });

  it("only superadmins can place a legal hold", () => {
    expect(PLATFORM_ROLES.filter((r) => canPlatform(r, "orgs:legal_hold"))).toEqual(["superadmin"]);
  });
});

/* ---------------- Stripe webhook ---------------- */

const stripeEvent = { current: null as unknown };
vi.mock("@/lib/billing", () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: async () => stripeEvent.current },
    subscriptions: { retrieve: async () => ({ id: "sub_1", items: { data: [{ price: { metadata: { pt_plan: "business" } } }] } }) },
  }),
  planForPrice: (price: { metadata?: { pt_plan?: PlanId } } | undefined) => price?.metadata?.pt_plan ?? null,
}));

describe("stripe webhook plan drops", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-grace-"));
  let store: Store;
  let POST: (r: Request) => Promise<Response>;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
    POST = (await import("@/app/api/stripe/webhook/route")).POST;
  });
  afterAll(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    rmSync(dir, { recursive: true, force: true });
  });

  const deliver = (id: string, type: string, object: unknown) => {
    stripeEvent.current = { id, type, data: { object } };
    return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=x" }, body: "{}" }));
  };
  const sub = (plan: PlanId | null, status = "active") => ({ id: "sub_1", status, metadata: { orgId: "org_wh" }, items: { data: [{ price: plan ? { metadata: { pt_plan: plan } } : null }] } });

  it("a downgrade sets the grace, a cancellation keeps the longest window, and an upgrade clears it", async () => {
    const org: Organization = { id: "org_wh", name: "Webhook Co", plan: "business", dataRegion: "ap-south-1", stripeSubscriptionId: "sub_1", createdAt: "2026-01-01T00:00:00Z" };
    await store.createOrg(org, "usr_wh");

    const before = Date.now();
    expect((await deliver("evt_1", "customer.subscription.updated", sub("growth"))).status).toBe(200);
    let now = await store.getOrg("org_wh");
    expect(now?.plan).toBe("growth");
    expect(now?.retentionGrace).toMatchObject({ logRetentionDays: 2555, fromPlan: "business" });
    const until = Date.parse(now!.retentionGrace!.until);
    expect(until).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(until).toBeLessThanOrEqual(Date.now() + 30 * DAY);

    expect((await deliver("evt_2", "customer.subscription.deleted", sub("growth", "canceled"))).status).toBe(200);
    now = await store.getOrg("org_wh");
    expect(now?.plan).toBe("free");
    expect(now?.stripeSubscriptionId).toBeUndefined();
    expect(now?.retentionGrace).toMatchObject({ logRetentionDays: 2555, fromPlan: "business" });

    const audit = (await store.listAudit("org_wh")).map((e) => e.action);
    expect(audit.filter((a) => a === "retention.grace_started")).toHaveLength(2);
    expect(audit.filter((a) => a === "billing.plan_changed")).toHaveLength(2);

    expect((await deliver("evt_3", "customer.subscription.updated", sub("business"))).status).toBe(200);
    now = await store.getOrg("org_wh");
    expect(now?.plan).toBe("business");
    expect(now?.retentionGrace).toBeUndefined();
  });
});
