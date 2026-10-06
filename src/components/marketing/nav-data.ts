import type { ComponentType } from "react";
import {
  IconAlert,
  IconAnalytics,
  IconChain,
  IconCode,
  IconHeld,
  IconInstall,
  IconLayoutBar,
  IconPlug,
  IconReceipt,
  IconRegion,
  IconScan,
  IconShieldCheck,
  IconSites,
  type IconProps,
} from "@/components/icons";

export interface NavItem {
  href: string;
  title: string;
  description: string;
  icon?: ComponentType<IconProps>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Product menu, grouped by the job each part does. */
export const PRODUCT_GROUPS: NavGroup[] = [
  {
    label: "Configure",
    items: [
      { href: "/#platform", title: "Consent banner", description: "Bar, modal or corner notice in your brand.", icon: IconLayoutBar },
      { href: "/#platform", title: "Tracker blocking", description: "Scripts wait until the visitor chooses.", icon: IconHeld },
      { href: "/#platform", title: "Region rules", description: "The right law's notice for each visitor.", icon: IconRegion },
    ],
  },
  {
    label: "Prove",
    items: [
      { href: "/#proof", title: "Consent log", description: "Hash-chained receipts anyone can verify.", icon: IconChain },
      { href: "/#proof", title: "Leak alerts", description: "Know when a tracker fires after a decline.", icon: IconAlert },
      { href: "/#proof", title: "Evidence Pack", description: "One export for your auditor or regulator.", icon: IconReceipt },
    ],
  },
  {
    label: "Understand",
    items: [
      { href: "/#tour", title: "Tracker scanner", description: "Find every script your pages load.", icon: IconScan },
      { href: "/#tour", title: "Consent analytics", description: "Opt-in rates by country and device.", icon: IconAnalytics },
    ],
  },
];

/** Flat list for the mobile menu. */
export const PRODUCT_NAV: NavItem[] = PRODUCT_GROUPS.flatMap((g) => g.items);

export const COMPLIANCE_NAV: NavItem[] = [
  { href: "/compliance/gdpr", title: "GDPR", description: "EU, EEA and UK opt-in consent." },
  { href: "/compliance/ccpa", title: "CCPA/CPRA", description: "California opt-out and Global Privacy Control." },
  { href: "/compliance/dpdpa", title: "DPDPA", description: "India's DPDP Act and the 2025 Rules." },
  { href: "/security", title: "Security", description: "Encryption, residency and access controls.", icon: IconShieldCheck },
];

export const DEVELOPER_NAV: NavItem[] = [
  { href: "/docs", title: "Documentation", description: "Install in one line, then configure.", icon: IconCode },
  { href: "/docs#frameworks", title: "Framework packages", description: "React, Next.js, Vue, Svelte, Angular.", icon: IconPlug },
  { href: "/docs#rest-api", title: "REST API", description: "Config, consent receipts and anchors.", icon: IconInstall },
  { href: "/docs#wordpress", title: "WordPress plugin", description: "Add the script without touching code.", icon: IconSites },
];

export const FOOTER_NAV: NavGroup[] = [
  {
    label: "Product",
    items: [
      { href: "/#platform", title: "Consent banner", description: "" },
      { href: "/#platform", title: "Tracker blocking", description: "" },
      { href: "/#proof", title: "Consent log", description: "" },
      { href: "/#proof", title: "Leak alerts", description: "" },
      { href: "/#tour", title: "Consent analytics", description: "" },
      { href: "/pricing", title: "Pricing", description: "" },
    ],
  },
  {
    label: "Developers",
    items: [
      { href: "/docs", title: "Documentation", description: "" },
      { href: "/docs#frameworks", title: "Framework packages", description: "" },
      { href: "/docs#rest-api", title: "REST API", description: "" },
      { href: "/docs#wordpress", title: "WordPress plugin", description: "" },
      { href: "/demo", title: "Demo store", description: "" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/compliance/gdpr", title: "GDPR", description: "" },
      { href: "/compliance/ccpa", title: "CCPA/CPRA", description: "" },
      { href: "/compliance/dpdpa", title: "DPDPA", description: "" },
      { href: "/compliance/ccpa#detail", title: "Global Privacy Control", description: "" },
      { href: "/security", title: "Security", description: "" },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/contact-sales", title: "Talk to sales", description: "" },
      { href: "/brand", title: "Brand", description: "" },
      { href: "/login", title: "Log in", description: "" },
      { href: "/signup", title: "Try for free", description: "" },
    ],
  },
];

export const LEGAL_NAV: NavItem[] = [
  { href: "/legal/privacy", title: "Privacy notice", description: "" },
  { href: "/legal/terms", title: "Terms of service", description: "" },
  { href: "/legal/cookies", title: "Cookie policy", description: "" },
];
