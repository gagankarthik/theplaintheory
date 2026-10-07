import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./stripe";

export interface BillingSummary {
  subscription: {
    status: Stripe.Subscription.Status;
    interval: "month" | "year" | null;
    /** in the smallest currency unit, as Stripe sends it */
    amount: number | null;
    currency: string;
    /** ISO date the current period ends: the next charge, or the end of access when cancelling */
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
  } | null;
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  invoices: {
    id: string;
    number: string | null;
    date: string;
    amount: number;
    currency: string;
    status: Stripe.Invoice.Status | null;
    url: string | null;
    pdf: string | null;
  }[];
}

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

function cardOf(pm: string | Stripe.PaymentMethod | null | undefined): BillingSummary["card"] {
  if (!pm || typeof pm === "string" || !pm.card) return null;
  return { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
}

/**
 * The organization's subscription, card on file and recent invoices, read live from Stripe.
 * Null when Stripe isn't configured or there's no customer yet; never throws (the page explains instead).
 */
export async function getBillingSummary(customerId?: string): Promise<BillingSummary | null> {
  const stripe = getStripe();
  if (!stripe || !customerId) return null;
  try {
    const [subs, invoices, customer] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 3, expand: ["data.default_payment_method"] }),
      stripe.invoices.list({ customer: customerId, limit: 6 }),
      stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] }),
    ]);
    // the live subscription if there is one, else the most recent
    const sub = subs.data.find((s) => ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status)) ?? subs.data[0];
    const item = sub?.items.data[0];
    const price = item?.price;
    const customerCard = !customer.deleted ? cardOf(customer.invoice_settings?.default_payment_method) : null;
    return {
      subscription: sub
        ? {
            status: sub.status,
            interval: (price?.recurring?.interval as "month" | "year" | undefined) ?? null,
            amount: item && price?.unit_amount != null ? price.unit_amount * (item.quantity ?? 1) : null,
            currency: sub.currency,
            periodEnd: iso(item?.current_period_end),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            trialEnd: iso(sub.trial_end),
          }
        : null,
      card: cardOf(sub?.default_payment_method) ?? customerCard,
      invoices: invoices.data.map((i) => ({
        id: i.id ?? "",
        number: i.number,
        date: iso(i.created)!,
        amount: i.total,
        currency: i.currency,
        status: i.status,
        url: i.hosted_invoice_url ?? null,
        pdf: i.invoice_pdf ?? null,
      })),
    };
  } catch {
    return null;
  }
}

export function formatMoney(minor: number, currency: string) {
  const zeroDecimal = ["jpy", "krw"].includes(currency.toLowerCase());
  return new Intl.NumberFormat(currency.toLowerCase() === "inr" ? "en-IN" : "en-US", { style: "currency", currency: currency.toUpperCase() }).format(zeroDecimal ? minor : minor / 100);
}
