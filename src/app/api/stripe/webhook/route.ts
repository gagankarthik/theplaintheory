import type Stripe from "stripe";
import { recordAudit } from "@/lib/audit";
import { getStripe, planForPrice } from "@/lib/billing";
import { getStore } from "@/lib/store";

/**
 * Stripe webhook: keeps each organization's plan in sync with its subscription.
 * Configure the endpoint for checkout.session.completed and customer.subscription.{updated,deleted}.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "Billing isn't configured." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing stripe-signature header." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Signature verification failed." }, { status: 400 });
  }

  const store = await getStore();
  // Stripe delivers at least once: an event we've already handled is acknowledged without re-applying it.
  if (!(await store.claimStripeEvent(event.id))) return Response.json({ received: true, duplicate: true });
  const auditPlan = async (orgId: string, plan: string | null | undefined) => {
    const before = await store.getOrg(orgId);
    if (!before || !plan || before.plan === plan) return;
    await recordAudit({ orgId, actor: { system: "stripe" }, action: "billing.plan_changed", target: { type: "org", id: orgId, label: before.name }, metadata: { from: before.plan, to: plan, event: event.type } });
  };
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const orgId = s.metadata?.orgId ?? s.client_reference_id;
        if (!orgId || typeof s.subscription !== "string") break;
        const sub = await stripe.subscriptions.retrieve(s.subscription);
        const plan = planForPrice(sub.items.data[0]?.price);
        await auditPlan(orgId, plan);
        await store.updateOrg(orgId, {
          stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id,
          stripeSubscriptionId: sub.id,
          ...(plan ? { plan } : {}),
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;
        const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(sub.status);
        const plan = active ? planForPrice(sub.items.data[0]?.price) : "free";
        await auditPlan(orgId, plan ?? "free");
        await store.updateOrg(orgId, { plan: plan ?? "free", stripeSubscriptionId: active ? sub.id : undefined });
        break;
      }
    }
  } catch (e) {
    // Non-2xx makes Stripe retry with backoff.
    console.error("stripe webhook", event.type, e);
    await store.releaseStripeEvent(event.id).catch(() => undefined); // let the retry be processed
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }
  return Response.json({ received: true });
}
