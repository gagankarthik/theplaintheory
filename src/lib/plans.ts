import type { PlanId } from "./types";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number | null;
  pageviews: number | null;
  properties: number | null;
  seats: number | null;
  logRetentionDays: number;
  summary: string;
  features: string[];
  /** env var holding the Stripe price id */
  stripePriceEnv?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    pageviews: 10_000,
    properties: 1,
    seats: 1,
    logRetentionDays: 30,
    summary: "For a personal site or a side project.",
    features: ["1 website", "10k pageviews a month", "GDPR, CCPA and DPDPA notices", "30-day consent log"],
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 29,
    pageviews: 250_000,
    properties: 10,
    seats: 5,
    logRetentionDays: 730,
    summary: "For teams and agencies running several sites.",
    features: [
      "10 websites",
      "250k pageviews a month",
      "Automatic tracker scanning",
      "Opt-in analytics by country and device",
      "2-year tamper-evident consent log",
      "5 team seats with roles",
    ],
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: null,
    pageviews: null,
    properties: null,
    seats: null,
    logRetentionDays: 3650,
    summary: "For regulated businesses that answer to auditors.",
    features: [
      "Unlimited websites and seats",
      "Data pinned to Mumbai, Hyderabad or Frankfurt",
      "Cross-domain consent sharing",
      "SSO and audit-ready PDF reports",
      "99.99% delivery SLA",
      "Named compliance contact",
    ],
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!;
