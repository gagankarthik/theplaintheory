import "server-only";
import type { Currency, Plan } from "./plans";
import { absoluteUrl } from "./site";
import { getStripe } from "./stripe";
import { getCatalog, priceIdFor } from "./stripe-catalog";
import type { Organization } from "./types";

export { getStripe } from "./stripe";
export { planForPrice, priceIdFor } from "./stripe-catalog";

export type BillingInterval = "monthly" | "annual";

/** Stripe is connected and has at least one plan's prices. */
export async function billingConfigured() {
  const catalog = getStripe() ? await getCatalog() : null;
  return Boolean(catalog && Object.keys(catalog).length);
}


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
  const price = await priceIdFor(plan.id, interval);
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
