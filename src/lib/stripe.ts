import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/** Null when STRIPE_SECRET_KEY isn't set, so billing UI can explain instead of failing. */
export function getStripe(): Stripe | null {
  if (client === undefined) client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  return client;
}
