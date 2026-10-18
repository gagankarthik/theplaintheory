// Public, indexable routes, for the sitemap.
import { INDUSTRIES } from "./industries";

export const COMPLIANCE_SLUGS = ["gdpr", "ccpa", "dpdpa"] as const;
export type ComplianceSlug = (typeof COMPLIANCE_SLUGS)[number];

/** `updated` is when the page content last changed (ISO date): the sitemap reports it as lastmod. */
export const MARKETING_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly"; updated: string }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly", updated: "2026-10-15" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly", updated: "2026-10-06" },
  { path: "/industries", priority: 0.9, changeFrequency: "monthly", updated: "2026-10-15" },
  { path: "/compliance", priority: 0.9, changeFrequency: "monthly", updated: "2026-10-15" },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly", updated: "2026-10-07" },
  { path: "/docs", priority: 0.8, changeFrequency: "weekly", updated: "2026-10-06" },
  { path: "/cookie-consent", priority: 0.9, changeFrequency: "monthly", updated: "2026-10-18" },
  { path: "/cookie-scanner", priority: 0.9, changeFrequency: "monthly", updated: "2026-10-18" },
  { path: "/google-consent-mode", priority: 0.8, changeFrequency: "monthly", updated: "2026-10-18" },
  { path: "/consent-log", priority: 0.8, changeFrequency: "monthly", updated: "2026-10-18" },
  ...COMPLIANCE_SLUGS.map((s) => ({ path: `/compliance/${s}`, priority: 0.8, changeFrequency: "monthly" as const, updated: "2026-10-06" })),
  ...INDUSTRIES.map((i) => ({ path: `/industries/${i.slug}`, priority: 0.7, changeFrequency: "monthly" as const, updated: "2026-10-15" })),
  { path: "/security", priority: 0.7, changeFrequency: "monthly", updated: "2026-10-06" },
  { path: "/brand", priority: 0.4, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/credits", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-15" },
];
