export const site = {
  /** Display name used in the UI, titles and the wordmark. */
  name: "Plain Theory",
  /** Registered company name for legal pages and structured data. */
  legalName: "The Plain Theory",
  shortName: "Plain Theory",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  tagline: "Consent management for GDPR, CCPA and DPDPA",
  description:
    "Plain Theory is a consent management platform for GDPR, CCPA/CPRA and India's DPDPA. A consent script under 10 KB, tracker blocking, notices in 22 Indian languages and a tamper-evident consent log.",
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
  /** Privacy requests, data subject rights and DPDP grievances. */
  privacyEmail: "privacy@theplaintheory.com",
  /** Contracts, legal notices and the terms of service. */
  legalEmail: "legal@theplaintheory.com",
};

/**
 * Facts only the business owner can confirm. Legal pages render a field only when it is set, so
 * leave a value null rather than guessing. Fill these in before launch.
 */
export const legal: {
  /** Full registered office address, e.g. "12 Example Road, Bengaluru 560001, India". */
  registeredOffice: string | null;
  /** Company registration number (for India, the CIN or LLPIN). */
  registrationNumber: string | null;
  /** Tax registration shown on invoices, e.g. "GSTIN 29ABCDE1234F1Z5". */
  taxId: string | null;
  /** Law that governs the terms of service. */
  governingLaw: string;
  /** Courts with exclusive jurisdiction over disputes, e.g. "the courts of Bengaluru, India". */
  courts: string;
  /** Grievance Officer under India's DPDP Act. Without a name, pages say "our Grievance Officer". */
  grievanceOfficer: { name: string; email: string } | null;
} = {
  registeredOffice: null,
  registrationNumber: null,
  taxId: null,
  governingLaw: "the laws of India",
  courts: "the courts of India",
  grievanceOfficer: null,
};

export const absoluteUrl = (path = "/") => new URL(path, site.url).toString();
