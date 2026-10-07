import "server-only";
import Stripe from "stripe";
import { PLANS, type Currency, type Plan } from "./plans";
import { absoluteUrl } from "./site";
import type { Organization, PlanId } from "./types";

export type BillingInterval = "monthly" | "annual";

let client: Stripe | null | undefined;

/** Null when STRIPE_SECRET_KEY isn't set, so billing UI can explain instead of failing. */
export function getStripe(): Stripe | null {
  if (client === undefined) client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  return client;
}

/** STRIPE_PRICE_GROWTH for monthly, STRIPE_PRICE_GROWTH_ANNUAL for annual. */
export const priceIdFor = (plan: Plan, interval: BillingInterval = "monthly") =>
  plan.stripePriceEnv ? process.env[`${plan.stripePriceEnv}${interval === "annual" ? "_ANNUAL" : ""}`] : undefined;

export function planForPrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  return PLANS.find((p) => priceIdFor(p, "monthly") === priceId || priceIdFor(p, "annual") === priceId)?.id ?? null;
}

export const billingConfigured = () => Boolean(getStripe() && PLANS.some((p) => priceIdFor(p)));

/** Annual billing: two months free. */
export const annualPrice = (monthly: number) => monthly * 10;

/**
 * Stripe Checkout for a subscription on `org`. Returns null when Stripe or this plan's price isn't
 * configured, so callers can explain instead of failing. The plan changes only when the webhook confirms.
 */
export async function createCheckoutUrl({
  org,
  email,
  plan,
  interval,
  currency,
  successPath = "/app/billing?checkout=success",
  cancelPath = "/app/billing?checkout=cancelled",
}: {
  org: Pick<Organization, "id" | "stripeCustomerId">;
  email: string;
  plan: Plan;
  interval: BillingInterval;
  currency: Currency;
  successPath?: string;
  cancelPath?: string;
}): Promise<string | null> {
  const stripe = getStripe();
  const price = priceIdFor(plan, interval);
  if (!stripe || !price) return null;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Each price carries EUR, GBP and INR as Stripe currency options; USD is the default.
    currency,
    line_items: [{ price, quantity: 1 }],
    customer: org.stripeCustomerId,
    customer_email: org.stripeCustomerId ? undefined : email,
    client_reference_id: org.id,
    metadata: { orgId: org.id },
    subscription_data: { metadata: { orgId: org.id } },
    allow_promotion_codes: true,
    success_url: absoluteUrl(successPath),
    cancel_url: absoluteUrl(cancelPath),
  });
  return session.url;
}
