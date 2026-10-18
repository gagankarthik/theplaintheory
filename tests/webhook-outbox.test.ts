import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Property, WebhookDelivery, WebhookRetry } from "@/lib/types";

vi.mock("server-only", () => ({}));

const state = { deliveries: [] as WebhookDelivery[], outbox: [] as WebhookRetry[], responses: [] as number[] };
const property = {
  id: "prop_1",
  orgId: "org_1",
  siteKey: "pk_test",
  webhooks: [{ id: "wh_1", url: "https://93.184.216.34/hook", secret: "s", events: ["consent.created"], active: true }],
} as unknown as Property;

vi.mock("@/lib/store", () => ({
  getStore: async () => ({
    recordWebhookDelivery: async (d: WebhookDelivery) => void state.deliveries.push(d),
    enqueueWebhookRetry: async (r: WebhookRetry) => void state.outbox.push(r),
    claimDueWebhookRetries: async (now: string, limit: number) => {
      const due = state.outbox.filter((r) => r.dueAt <= now).slice(0, limit);
      state.outbox = state.outbox.filter((r) => !due.includes(r));
      return due;
    },
    getProperty: async () => property,
    getOrg: async () => ({ id: "org_1", plan: "business" }),
  }),
}));

beforeEach(() => {
  state.deliveries = [];
  state.outbox = [];
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: state.responses.shift() ?? 200 })));
});

describe("durable webhook delivery", () => {
  it("queues a 503 for retry in a minute, then delivers it with the same delivery id", async () => {
    const { dispatchWebhooks, drainWebhookRetries } = await import("@/lib/webhooks");
    state.responses = [503, 200];
    await dispatchWebhooks(property, { plan: "business" }, "consent.created", { receipt: { id: "r1" } });
    expect(state.deliveries).toHaveLength(1);
    expect(state.deliveries[0]).toMatchObject({ status: "failed", httpStatus: 503, attempt: 1 });
    expect(state.deliveries[0].nextAttemptAt).toBeDefined();
    expect(state.outbox).toHaveLength(1);
    const dueAt = Date.parse(state.outbox[0].dueAt);
    expect(dueAt - Date.parse(state.deliveries[0].createdAt)).toBe(60_000);

    // not due yet: nothing sent
    expect(await drainWebhookRetries({ now: new Date(dueAt - 1000) })).toEqual({ sent: 0, dropped: 0 });
    expect(await drainWebhookRetries({ now: new Date(dueAt + 1000) })).toEqual({ sent: 1, dropped: 0 });
    expect(state.deliveries[1]).toMatchObject({ status: "delivered", attempt: 2 });
    const [first, second] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.map((c) => new Headers(c[1].headers).get("x-plain-delivery"));
    expect(second).toBe(first);
    expect(state.outbox).toHaveLength(0);
  });

  it("doesn't retry a refusal (400), and marks it final", async () => {
    const { dispatchWebhooks } = await import("@/lib/webhooks");
    state.responses = [400];
    await dispatchWebhooks(property, { plan: "business" }, "consent.created", {});
    expect(state.deliveries[0]).toMatchObject({ status: "failed", httpStatus: 400, final: true });
    expect(state.outbox).toHaveLength(0);
  });

  it("gives up after the last attempt", async () => {
    const { drainWebhookRetries, MAX_ATTEMPTS } = await import("@/lib/webhooks");
    state.outbox = [{ id: "w", deliveryId: "dlv_x", propertyId: "prop_1", webhookId: "wh_1", attempt: MAX_ATTEMPTS, dueAt: new Date(0).toISOString(), payload: { event: "consent.created", siteKey: "pk_test" } }];
    state.responses = [500];
    await drainWebhookRetries();
    expect(state.deliveries[0]).toMatchObject({ attempt: MAX_ATTEMPTS, final: true });
    expect(state.outbox).toHaveLength(0);
  });

  it("drops a retry whose webhook was deleted", async () => {
    const { drainWebhookRetries } = await import("@/lib/webhooks");
    state.outbox = [{ id: "w", deliveryId: "dlv_y", propertyId: "prop_1", webhookId: "wh_gone", attempt: 2, dueAt: new Date(0).toISOString(), payload: {} }];
    expect(await drainWebhookRetries()).toEqual({ sent: 0, dropped: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
