// Public, indexable routes. Shared by the sitemap and the marketing footer.

export const COMPLIANCE_SLUGS = ["gdpr", "ccpa", "dpdpa"] as const;
export type ComplianceSlug = (typeof COMPLIANCE_SLUGS)[number];

/** `updated` is when the page content last changed (ISO date): the sitemap reports it as lastmod. */
export const MARKETING_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly"; updated: string }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly", updated: "2026-10-06" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly", updated: "2026-10-06" },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly", updated: "2026-10-07" },
  { path: "/contact-sales", priority: 0.7, changeFrequency: "yearly", updated: "2026-10-07" },
  { path: "/contact/support", priority: 0.6, changeFrequency: "yearly", updated: "2026-10-07" },
  { path: "/contact/partners", priority: 0.5, changeFrequency: "yearly", updated: "2026-10-07" },
  { path: "/contact/enterprise", priority: 0.6, changeFrequency: "yearly", updated: "2026-10-07" },
  { path: "/docs", priority: 0.8, changeFrequency: "weekly", updated: "2026-10-06" },
  ...COMPLIANCE_SLUGS.map((s) => ({ path: `/compliance/${s}`, priority: 0.8, changeFrequency: "monthly" as const, updated: "2026-10-06" })),
  { path: "/security", priority: 0.7, changeFrequency: "monthly", updated: "2026-10-06" },
  { path: "/brand", priority: 0.4, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-06" },
  { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly", updated: "2026-10-06" },
];
