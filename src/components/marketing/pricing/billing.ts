import { PLANS, SELF_SERVE_PLANS, formatPrice, planPrice, type Currency, type Plan } from "@/lib/plans";

export type { Currency };
export type Period = "monthly" | "annual";

/** Annual billing charges 10 months for 12. */
export const ANNUAL_MONTHS_CHARGED = 10;
export const GST_RATE = 0.18;

/** Per-domain price used for the savings estimate: Cookiebot "Small", €15 per domain per month. */
export const PER_DOMAIN_EUR = 15;
export const PER_DOMAIN_SOURCE = {
  label: "Cookiebot pricing page, Small tier",
  url: "https://www.cookiebot.com/en/pricing/",
  fetched: "October 2026",
};

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatMoney = formatPrice;

export const formatEur = (n: number) => eur.format(n);

export const listPrice = planPrice;

export interface Quote {
  /** effective price per month for the chosen period */
  perMonth: number;
  /** total charged per billing period */
  charged: number;
  /** what the same 12 months would cost on monthly billing */
  monthlyEquivalentYear: number;
}

export function quote(plan: Plan, currency: Currency, period: Period): Quote | null {
  const price = listPrice(plan, currency);
  if (price === null) return null;
  if (period === "monthly") return { perMonth: price, charged: price, monthlyEquivalentYear: price * 12 };
  const charged = listPrice(plan, currency, "annual") ?? price * ANNUAL_MONTHS_CHARGED;
  return { perMonth: Math.round((charged / 12) * 100) / 100, charged, monthlyEquivalentYear: price * 12 };
}

/** "90 days", "1 year", "7 years" */
export function retentionLabel(days: number) {
  if (days < 365) return `${days} days`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"}`;
}

export const compactNumber = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : n >= 1_000 ? `${Math.round(n / 1000)}k` : String(n);

/** The smallest self-serve plan that fits; Enterprise when nothing does. Pass live plans to price it. */
export function recommendPlan(sites: number, pageviews: number, plans: Plan[] = PLANS): Plan {
  const selfServe = plans.filter((p) => SELF_SERVE_PLANS.some((s) => s.id === p.id));
  const fit = selfServe.find(
    (p) => (p.properties === null || p.properties >= sites) && (p.pageviews === null || p.pageviews >= pageviews),
  );
  return fit ?? plans[plans.length - 1];
}
