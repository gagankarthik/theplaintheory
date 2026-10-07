/**
 * Make Stripe match src/lib/plans.ts: products, monthly + yearly prices (USD with EUR, GBP and INR
 * currency options) and the customer portal. Idempotent: run it after changing a plan.
 *
 *   npm run stripe:sync            test mode (refuses a live key)
 *   npm run stripe:sync -- --live  live mode, after reviewing the dry run
 *   npm run stripe:sync -- --dry   show what would change, change nothing
 *
 * A changed amount never edits a price in place (Stripe prices are immutable): a new price takes over
 * the lookup key and the old one is archived, so existing subscribers keep what they signed up for.
 */
import Stripe from "stripe";
import { PLANS, planPrice, type Currency, type Plan } from "../src/lib/plans.ts";

const live = process.argv.includes("--live");
const dry = process.argv.includes("--dry");
const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key) throw new Error("STRIPE_SECRET_KEY isn't set (run with --env-file=.env.local).");
if (key.startsWith("sk_live_") && !live) throw new Error("That's a live key. Re-run with --live once you've reviewed a --dry run.");

const stripe = new Stripe(key);
const SITE = (process.env.STRIPE_SYNC_SITE_URL || "https://www.theplaintheory.in").replace(/\/$/, "");
const CURRENCIES: Currency[] = ["usd", "eur", "gbp", "inr"];
const INTERVALS = ["monthly", "annual"] as const;
const paid = PLANS.filter((p) => p.priceMonthly !== null && p.priceMonthly > 0);

const log = (msg: string) => console.log(`${dry ? "[dry] " : ""}${msg}`);
const minor = (n: number) => Math.round(n * 100);

function desired(plan: Plan, interval: (typeof INTERVALS)[number]) {
  return Object.fromEntries(CURRENCIES.map((c) => [c, minor(planPrice(plan, c, interval) ?? 0)])) as Record<Currency, number>;
}

function same(price: Stripe.Price, want: Record<Currency, number>) {
  if (price.currency !== "usd" || price.unit_amount !== want.usd) return false;
  return CURRENCIES.filter((c) => c !== "usd").every((c) => price.currency_options?.[c]?.unit_amount === want[c]);
}

async function syncProduct(plan: Plan) {
  const found = (await stripe.products.search({ query: `metadata["pt_plan"]:"${plan.id}"` })).data[0];
  const fields = {
    name: `Plain Theory ${plan.name}`,
    description: plan.summary,
    marketing_features: plan.features.slice(0, 15).map((name) => ({ name })),
    metadata: { pt_plan: plan.id },
  };
  if (found) {
    log(`product ${plan.id}: up to date (${found.id})`);
    if (!dry) await stripe.products.update(found.id, { ...fields, active: true });
    return found.id;
  }
  log(`product ${plan.id}: create`);
  return dry ? `prod_dry_${plan.id}` : (await stripe.products.create({ ...fields, tax_code: "txcd_10103001" })).id;
}

async function syncPrice(plan: Plan, productId: string, interval: (typeof INTERVALS)[number]) {
  const lookup = `pt_${plan.id}_${interval}`;
  const want = desired(plan, interval);
  const current = (await stripe.prices.list({ lookup_keys: [lookup], expand: ["data.currency_options"], limit: 1 })).data[0];
  if (current && current.active && same(current, want)) {
    log(`price ${lookup}: up to date (${current.id})`);
    return current.id;
  }
  log(`price ${lookup}: ${current ? `amounts changed, replace ${current.id}` : "create"} (${CURRENCIES.map((c) => `${c} ${want[c] / 100}`).join(", ")})`);
  if (dry) return current?.id ?? `price_dry_${lookup}`;
  const created = await stripe.prices.create({
    product: productId,
    lookup_key: lookup,
    transfer_lookup_key: true,
    nickname: `${plan.name} ${interval}`,
    currency: "usd",
    unit_amount: want.usd,
    tax_behavior: "exclusive",
    recurring: { interval: interval === "annual" ? "year" : "month" },
    currency_options: Object.fromEntries(CURRENCIES.filter((c) => c !== "usd").map((c) => [c, { unit_amount: want[c], tax_behavior: "exclusive" as const }])),
    metadata: { pt_plan: plan.id, pt_interval: interval },
  });
  if (current) await stripe.prices.update(current.id, { active: false });
  return created.id;
}

async function syncPortal(products: { product: string; prices: string[] }[]) {
  const params = {
    business_profile: { headline: "Manage your Plain Theory plan", privacy_policy_url: `${SITE}/legal/privacy`, terms_of_service_url: `${SITE}/legal/terms` },
    default_return_url: `${SITE}/app/billing`,
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] as const },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" as const, cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] as const } },
      subscription_update: { enabled: true, default_allowed_updates: ["price"] as const, proration_behavior: "create_prorations" as const, products },
    },
    metadata: { pt_portal: "1" },
  };
  const existing = (await stripe.billingPortal.configurations.list({ active: true, limit: 20 })).data.find((c) => c.metadata?.pt_portal === "1");
  log(`customer portal: ${existing ? `update ${existing.id}` : "create"}`);
  if (dry) return;
  // Stripe's types want mutable arrays; the literals above are readonly for safety.
  const p = JSON.parse(JSON.stringify(params));
  if (existing) await stripe.billingPortal.configurations.update(existing.id, p);
  else await stripe.billingPortal.configurations.create(p);
}

const account = await stripe.accounts.retrieveCurrent();
log(`Stripe ${key.startsWith("sk_live_") ? "LIVE" : "test"} mode, account ${account.id}`);
const portalProducts: { product: string; prices: string[] }[] = [];
for (const plan of paid) {
  const productId = await syncProduct(plan);
  const prices = [];
  for (const interval of INTERVALS) prices.push(await syncPrice(plan, productId, interval));
  portalProducts.push({ product: productId, prices });
}
await syncPortal(portalProducts);
log("done");
