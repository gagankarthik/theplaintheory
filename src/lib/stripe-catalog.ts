import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { PLANS, type Currency, type Plan } from "./plans";
import type { PlanId } from "./types";

/**
 * Stripe is the source of truth for prices. Each paid plan has two prices in Stripe, found by stable
 * lookup keys (pt_<plan>_monthly, pt_<plan>_annual) and carrying `metadata.pt_plan`, with EUR, GBP and
 * INR as currency options. `scripts/stripe-sync.ts` creates and updates them from src/lib/plans.ts;
 * after that, a price edited in Stripe shows up here within the cache window.
 *
 * Plan limits and features stay in plans.ts: the app enforces them, Stripe just bills for them.
 */
export type Interval = "monthly" | "annual";

export const lookupKey = (plan: PlanId, interval: Interval) => `pt_${plan}_${interval}`;

const PAID: PlanId[] = ["starter", "growth", "business"];
const CURRENCIES: Currency[] = ["usd", "eur", "gbp", "inr"];
const TTL_MS = 5 * 60_000;

export interface CatalogEntry {
  priceId: Record<Interval, string | undefined>;
  amount: Record<Interval, Partial<Record<Currency, number>>>;
}
export type Catalog = Partial<Record<PlanId, CatalogEntry>>;

let cache: { at: number; catalog: Catalog } | null = null;
let inflight: Promise<Catalog | null> | null = null;

/** Major units (e.g. 29 or 1999) for every currency a price is offered in. */
function amounts(price: Stripe.Price) {
  const out: Partial<Record<Currency, number>> = {};
  if (price.unit_amount !== null) out[price.currency as Currency] = price.unit_amount / 100;
  for (const c of CURRENCIES) {
    const opt = price.currency_options?.[c];
    if (opt?.unit_amount !== undefined && opt.unit_amount !== null) out[c] = opt.unit_amount / 100;
  }
  return out;
}

async function load(stripe: Stripe): Promise<Catalog> {
  const keys = PAID.flatMap((p) => [lookupKey(p, "monthly"), lookupKey(p, "annual")]);
  const { data } = await stripe.prices.list({ lookup_keys: keys, active: true, limit: keys.length, expand: ["data.currency_options"] });
  const catalog: Catalog = {};
  for (const price of data) {
    const [, plan, interval] = (price.lookup_key ?? "").split("_") as [string, PlanId, Interval];
    if (!PAID.includes(plan) || (interval !== "monthly" && interval !== "annual")) continue;
    const entry = (catalog[plan] ??= { priceId: { monthly: undefined, annual: undefined }, amount: { monthly: {}, annual: {} } });
    entry.priceId[interval] = price.id;
    entry.amount[interval] = amounts(price);
  }
  return catalog;
}

/**
 * The live catalog, cached for five minutes per server instance. Null when Stripe isn't configured.
 * If Stripe can't be reached, the last good catalog is served; with none yet, the caller falls back
 * to plans.ts list prices, which `stripe-sync` keeps identical to Stripe.
 */
export async function getCatalog(): Promise<Catalog | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.catalog;
  inflight ??= load(stripe)
    .then((catalog) => {
      cache = { at: Date.now(), catalog };
      return catalog;
    })
    .catch((e) => {
      console.error("[stripe-catalog] couldn't load prices", e);
      return cache?.catalog ?? null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Plans with their prices taken from Stripe. */
export async function getLivePlans(): Promise<Plan[]> {
  const catalog = await getCatalog();
  if (!catalog) return PLANS;
  return PLANS.map((plan) => {
    const live = catalog[plan.id];
    if (!live) return plan;
    const m = live.amount.monthly;
    return {
      ...plan,
      priceMonthly: m.usd ?? plan.priceMonthly,
      priceMonthlyEur: m.eur ?? plan.priceMonthlyEur,
      priceMonthlyGbp: m.gbp ?? plan.priceMonthlyGbp,
      priceMonthlyInr: m.inr ?? plan.priceMonthlyInr,
      annual: live.amount.annual,
      live: true,
    };
  });
}

/** The Stripe price to bill for a plan and interval, or undefined when it isn't set up in Stripe. */
export async function priceIdFor(plan: PlanId, interval: Interval): Promise<string | undefined> {
  return (await getCatalog())?.[plan]?.priceId[interval];
}

/** Which plan a Stripe price bills for: from its metadata, else its lookup key. */
export function planForPrice(price: Pick<Stripe.Price, "metadata" | "lookup_key"> | null | undefined): PlanId | null {
  if (!price) return null;
  const fromMeta = price.metadata?.pt_plan as PlanId | undefined;
  if (fromMeta && PAID.includes(fromMeta)) return fromMeta;
  const fromKey = price.lookup_key?.split("_")[1] as PlanId | undefined;
  return fromKey && PAID.includes(fromKey) ? fromKey : null;
}

let portalConfig: { at: number; id: string | undefined } | null = null;

/** The customer-portal configuration created by stripe-sync (metadata pt_portal=1), cached like prices. */
export async function portalConfigurationId(): Promise<string | undefined> {
  const stripe = getStripe();
  if (!stripe) return undefined;
  if (portalConfig && Date.now() - portalConfig.at < TTL_MS) return portalConfig.id;
  try {
    const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
    portalConfig = { at: Date.now(), id: data.find((c) => c.metadata?.pt_portal === "1")?.id };
  } catch (e) {
    console.error("[stripe-catalog] couldn't load the portal configuration", e);
  }
  return portalConfig?.id;
}
