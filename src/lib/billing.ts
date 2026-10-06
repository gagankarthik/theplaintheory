import "server-only";
import Stripe from "stripe";
import { PLANS, type Plan } from "./plans";
import type { PlanId } from "./types";

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
