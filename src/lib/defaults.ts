import type { BannerConfig, CategoryCopy, Framework, RegionRule, Tracker } from "./types";

export const DEFAULT_CATEGORIES: CategoryCopy[] = [
  {
    id: "essential",
    label: "Essential",
    description: "Keeps the site working: sign-in, security and remembering this choice. Always on.",
    required: true,
  },
  {
    id: "functional",
    label: "Preferences",
    description: "Remembers settings like language and region so you don't have to set them again.",
    required: false,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Counts visits and shows which pages are useful. Reported in aggregate, never sold.",
    required: false,
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Lets ad partners show you relevant ads on other sites and measure whether they worked.",
    required: false,
  },
];

const gdprCopy = {
  title: "Your choice about cookies",
  body: "We use essential cookies to run this site. With your permission we'd also use analytics and marketing cookies. You can change this any time.",
  acceptAll: "Accept all",
  rejectAll: "Reject all",
  customize: "Choose categories",
  save: "Save my choices",
  policyLabel: "Cookie policy",
};

const ccpaCopy = {
  title: "Your privacy choices",
  body: "We and our partners use cookies for analytics and personalised ads, which California law may treat as selling or sharing your information. You can opt out.",
  acceptAll: "Okay",
  rejectAll: "Do not sell or share my info",
  customize: "Choose categories",
  save: "Save my choices",
  policyLabel: "Privacy notice",
};

const dpdpaCopy = {
  title: "Consent notice",
  body: "We collect only what each purpose below needs. Essential data runs the site. Everything else needs your consent, which you can withdraw as easily as you gave it. Contact our Data Protection Officer any time.",
  acceptAll: "I consent to all",
  rejectAll: "Essential only",
  customize: "Review each purpose",
  save: "Confirm my consent",
  policyLabel: "Privacy notice & DPO",
};

const genericCopy = {
  title: "Cookies on this site",
  body: "We use cookies to run the site and, if you agree, to understand how it's used.",
  acceptAll: "Accept",
  rejectAll: "Decline",
  customize: "Settings",
  save: "Save",
  policyLabel: "Learn more",
};

export const FRAMEWORK_META: Record<Framework, { name: string; law: string; region: string }> = {
  gdpr: { name: "GDPR", law: "General Data Protection Regulation", region: "EU, EEA & UK" },
  ccpa: { name: "CCPA/CPRA", law: "California Consumer Privacy Act", region: "California, US" },
  dpdpa: { name: "DPDPA", law: "Digital Personal Data Protection Act, 2023", region: "India" },
  generic: { name: "Default", law: "Fallback notice", region: "Rest of world" },
};

export const DEFAULT_REGIONS: Record<Framework, RegionRule> = {
  gdpr: { framework: "gdpr", enabled: true, model: "opt-in", copy: gdprCopy, language: "en" },
  ccpa: { framework: "ccpa", enabled: true, model: "opt-out", copy: ccpaCopy, language: "en" },
  dpdpa: { framework: "dpdpa", enabled: true, model: "opt-in", copy: dpdpaCopy, language: "en" },
  generic: { framework: "generic", enabled: true, model: "opt-in", copy: genericCopy, language: "en" },
};

export function defaultConfig(domain: string): BannerConfig {
  return {
    version: 1,
    theme: {
      layout: "bar",
      position: "bottom",
      background: "#FFFFFF",
      text: "#141B34",
      accent: "#2E2BD6",
      accentText: "#FFFFFF",
      radius: 12,
      font: "system",
      equalButtons: true,
    },
    categories: structuredClone(DEFAULT_CATEGORIES),
    regions: structuredClone(DEFAULT_REGIONS),
    policyUrl: `https://${domain}/privacy`,
    headless: false,
    googleConsentMode: true,
    expiryDays: 180,
  };
}

/** Well-known trackers matched by script src. The cookie scanner adds to this per property. */
export const KNOWN_TRACKERS: Omit<Tracker, "id">[] = [
  { name: "Google Analytics", category: "analytics", pattern: "googletagmanager.com/gtag" },
  { name: "Google Analytics (legacy)", category: "analytics", pattern: "google-analytics.com" },
  { name: "Hotjar", category: "analytics", pattern: "static.hotjar.com" },
  { name: "Microsoft Clarity", category: "analytics", pattern: "clarity.ms" },
  { name: "Mixpanel", category: "analytics", pattern: "cdn.mxpnl.com" },
  { name: "Meta Pixel", category: "marketing", pattern: "connect.facebook.net" },
  { name: "LinkedIn Insight", category: "marketing", pattern: "snap.licdn.com" },
  { name: "TikTok Pixel", category: "marketing", pattern: "analytics.tiktok.com" },
  { name: "Google Ads", category: "marketing", pattern: "googleadservices.com" },
  { name: "Intercom", category: "functional", pattern: "widget.intercom.io" },
];
