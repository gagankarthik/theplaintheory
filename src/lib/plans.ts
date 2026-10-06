import type { PlanId } from "./types";

/**
 * Plans are priced per account, not per domain. Caps are soft: going over notifies the owner and
 * gives a 30-day grace period. We never auto-upgrade or charge overage without an explicit choice.
 */
export interface Plan {
  id: PlanId;
  name: string;
  /** monthly price, USD; null = custom */
  priceMonthly: number | null;
  /** monthly price, INR excluding GST; null = custom */
  priceMonthlyInr: number | null;
  /** monthly price, EUR excluding VAT; null = custom */
  priceMonthlyEur: number | null;
  /** monthly price, GBP excluding VAT; null = custom */
  priceMonthlyGbp: number | null;
  /** monthly pageviews across all sites; null = custom */
  pageviews: number | null;
  /** null = unlimited */
  properties: number | null;
  seats: number | null;
  logRetentionDays: number;
  summary: string;
  features: string[];
  /** feature flags enforced in the product */
  limits: {
    evidencePack: boolean;
    webhooks: boolean;
    leakDetection: boolean;
    indianLanguages: boolean;
    residencyChoice: boolean;
    apiAccess: boolean;
  };
  /** env var holding the Stripe price id */
  stripePriceEnv?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceMonthlyInr: 0,
    priceMonthlyEur: 0,
    priceMonthlyGbp: 0,
    pageviews: 10_000,
    properties: 1,
    seats: 1,
    logRetentionDays: 90,
    summary: "For a personal site. Real blocking and a real consent log, not just a notice.",
    features: [
      "1 website, 10k pageviews a month",
      "Tracker blocking and Global Privacy Control",
      "Google Consent Mode v2",
      "GDPR, CCPA and DPDPA notices in English and Hindi",
      "90-day consent log",
    ],
    limits: { evidencePack: false, webhooks: false, leakDetection: true, indianLanguages: false, residencyChoice: false, apiAccess: false },
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 9,
    priceMonthlyInr: 499,
    priceMonthlyEur: 9,
    priceMonthlyGbp: 8,
    pageviews: 50_000,
    properties: 2,
    seats: 2,
    logRetentionDays: 365,
    summary: "For a small business with a site or two.",
    features: [
      "2 websites, 50k pageviews a month",
      "Notices in all 22 Indian languages",
      "1-year consent log with CSV export",
      "Leak alerts when trackers fire after a decline",
    ],
    limits: { evidencePack: false, webhooks: false, leakDetection: true, indianLanguages: true, residencyChoice: false, apiAccess: false },
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 29,
    priceMonthlyInr: 1_999,
    priceMonthlyEur: 29,
    priceMonthlyGbp: 25,
    pageviews: 250_000,
    properties: 10,
    seats: 5,
    logRetentionDays: 730,
    summary: "For teams and agencies running several sites.",
    features: [
      "10 websites, 250k pageviews a month",
      "Compliance Evidence Pack and chain verification",
      "Consent analytics by country, device and browser",
      "Data kept in India, the EU or the US",
      "5 team seats with roles",
    ],
    limits: { evidencePack: true, webhooks: false, leakDetection: true, indianLanguages: true, residencyChoice: true, apiAccess: false },
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 99,
    priceMonthlyInr: 6_999,
    priceMonthlyEur: 99,
    priceMonthlyGbp: 85,
    pageviews: 2_000_000,
    properties: null,
    seats: 20,
    logRetentionDays: 2555,
    summary: "For regulated teams and agencies with many client sites.",
    features: [
      "Unlimited websites, 2M pageviews a month",
      "7-year consent log retention",
      "Signed withdrawal webhooks to your CRM and tools",
      "Headless mode and the consent API",
      "20 team seats",
    ],
    limits: { evidencePack: true, webhooks: true, leakDetection: true, indianLanguages: true, residencyChoice: true, apiAccess: true },
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: null,
    priceMonthlyInr: null,
    priceMonthlyEur: null,
    priceMonthlyGbp: null,
    pageviews: null,
    properties: null,
    seats: null,
    logRetentionDays: 3650,
    summary: "For large and Significant Data Fiduciaries that answer to auditors.",
    features: [
      "Custom volume and dedicated residency",
      "SSO and audit-ready reports",
      "99.99% delivery SLA",
      "Named compliance contact",
    ],
    limits: { evidencePack: true, webhooks: true, leakDetection: true, indianLanguages: true, residencyChoice: true, apiAccess: true },
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id) ?? PLANS[0];

/** Self-serve plans shown as cards; Enterprise is presented separately. */
export const SELF_SERVE_PLANS = PLANS.filter((p) => p.id !== "enterprise");

export const formatInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Currencies we bill in. Each Stripe price carries these as currency options. */
export type Currency = "usd" | "eur" | "gbp" | "inr";

export const CURRENCIES: { id: Currency; code: string; symbol: string; name: string; plural: string; tax: string; locale: string }[] = [
  { id: "usd", code: "USD", symbol: "$", name: "US dollar", plural: "US dollars", tax: "excluding taxes", locale: "en-US" },
  { id: "eur", code: "EUR", symbol: "€", name: "Euro", plural: "euros", tax: "excluding VAT", locale: "en-IE" },
  { id: "gbp", code: "GBP", symbol: "£", name: "British pound", plural: "British pounds", tax: "excluding VAT", locale: "en-GB" },
  { id: "inr", code: "INR", symbol: "₹", name: "Indian rupee", plural: "Indian rupees", tax: "excluding 18% GST", locale: "en-IN" },
];

export const isCurrency = (v: unknown): v is Currency => CURRENCIES.some((c) => c.id === v);
export const currencyInfo = (c: Currency) => CURRENCIES.find((x) => x.id === c) ?? CURRENCIES[0];

/** Monthly list price in a currency; null = custom (Enterprise). */
export function planPrice(plan: Plan, currency: Currency): number | null {
  return { usd: plan.priceMonthly, eur: plan.priceMonthlyEur, gbp: plan.priceMonthlyGbp, inr: plan.priceMonthlyInr }[currency];
}

const formatters = new Map<string, Intl.NumberFormat>();
/** "$29", "€29", "£25", "₹1,999"; cents only when the amount isn't whole (annual per-month figures). */
export function formatPrice(amount: number, currency: Currency) {
  const whole = currency === "inr" || Number.isInteger(amount);
  const key = `${currency}:${whole}`;
  let f = formatters.get(key);
  if (!f) {
    const info = currencyInfo(currency);
    f = new Intl.NumberFormat(info.locale, { style: "currency", currency: info.code, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
    formatters.set(key, f);
  }
  return f.format(whole ? Math.round(amount) : amount);
}
