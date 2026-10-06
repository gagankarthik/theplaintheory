// Public, indexable routes. Shared by the sitemap and the marketing footer.

export const COMPLIANCE_SLUGS = ["gdpr", "ccpa", "dpdpa"] as const;
export type ComplianceSlug = (typeof COMPLIANCE_SLUGS)[number];

export const MARKETING_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/contact-sales", priority: 0.7, changeFrequency: "yearly" },
  { path: "/docs", priority: 0.8, changeFrequency: "weekly" },
  ...COMPLIANCE_SLUGS.map((s) => ({ path: `/compliance/${s}`, priority: 0.8, changeFrequency: "monthly" as const })),
  { path: "/security", priority: 0.7, changeFrequency: "monthly" },
  { path: "/brand", priority: 0.4, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly" },
];
