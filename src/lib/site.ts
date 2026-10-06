export const site = {
  name: "The Plain Theory",
  shortName: "Plain Theory",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  tagline: "Consent management in plain language",
  description:
    "The Plain Theory is a consent management platform for GDPR, CCPA/CPRA and India's DPDPA. A consent script under 10 KB, tracker blocking, region-aware banners and a tamper-evident consent log.",
  keywords: [
    "consent management platform",
    "cookie consent",
    "CMP",
    "GDPR cookie banner",
    "CCPA opt-out",
    "DPDPA consent",
    "DPDP Act 2023 compliance",
    "Google Consent Mode v2",
    "cookie banner for Next.js",
  ],
  twitter: "@plaintheory",
  email: "hello@theplaintheory.com",
};

export const absoluteUrl = (path = "/") => new URL(path, site.url).toString();
