import type { ComponentType } from "react";
import { IconBilling, IconBook, IconCart, IconCode, IconEducation, IconHealth, type IconProps } from "@/components/icons";
import { INDUSTRIES } from "@/lib/industries";

export interface NavLink {
  href: string;
  title: string;
  /** one line under the title where there is room (phone menu, cards) */
  description?: string;
  /** icon for cards that list these links, from the shared icon set */
  icon?: ComponentType<IconProps>;
}

export interface NavGroup {
  heading: string;
  links: NavLink[];
  /** a closing "View all … →" link at the foot of the column */
  viewAll?: NavLink;
}

export interface NavMenu {
  id: string;
  label: string;
  /** mega-menu columns, each with a small heading */
  groups: NavGroup[];
}

/** The four product pages, each with its one-line summary: for the Platform menu and their cross-links. */
export const FEATURE_LINKS: NavLink[] = [
  { href: "/cookie-consent", title: "Consent banner", description: "A cookie banner that holds trackers until visitors agree." },
  { href: "/cookie-scanner", title: "Cookie scanner", description: "Every cookie, storage key, script and pixel your site sets." },
  { href: "/google-consent-mode", title: "Google Consent Mode v2", description: "Google's consent signals, sent from the visitor's choice." },
  { href: "/consent-log", title: "Consent records", description: "A hash-chained log of every choice, ready for an auditor." },
];

const FEATURE_LINE = Object.fromEntries(FEATURE_LINKS.map((l) => [l.href, l.description])) as Record<string, string>;

/** The plain pricing link: inside the Platform menu, and in the footer. */
export const PRICING: NavLink = { href: "/pricing", title: "Pricing" };

export const PLATFORM: NavMenu = {
  id: "platform",
  label: "Platform",
  groups: [
    {
      heading: "Collect consent",
      links: [
        { href: "/cookie-consent", title: "Consent banner", description: FEATURE_LINE["/cookie-consent"] },
        { href: "/cookie-consent#blocking", title: "Script blocking" },
        { href: "/cookie-consent#studio", title: "Banner studio" },
        { href: "/google-consent-mode", title: "Google Consent Mode", description: FEATURE_LINE["/google-consent-mode"] },
      ],
    },
    {
      heading: "Find and prove",
      links: [
        { href: "/cookie-scanner", title: "Cookie scanner", description: FEATURE_LINE["/cookie-scanner"] },
        { href: "/consent-log", title: "Consent records and audit", description: FEATURE_LINE["/consent-log"] },
        { href: "/#inside", title: "Integrations" },
      ],
    },
    {
      heading: "Plans",
      links: [PRICING, { href: "/auth/signup", title: "Start free" }, { href: "/contact?topic=enterprise", title: "Enterprise" }],
      viewAll: { href: "/pricing#compare", title: "Compare plans" },
    },
  ],
};

const INDUSTRY_ICONS: Record<string, ComponentType<IconProps>> = {
  "ecommerce-retail": IconCart,
  "saas-technology": IconCode,
  healthcare: IconHealth,
  "financial-services": IconBilling,
  "media-publishing": IconBook,
  education: IconEducation,
};

/** Every industry page, for menus, cards and the footer. */
export const INDUSTRY_LINKS: NavLink[] = INDUSTRIES.map((i) => ({ href: `/industries/${i.slug}`, title: i.menu, description: i.summary, icon: INDUSTRY_ICONS[i.slug] }));

export const COMPLIANCE_LINKS: NavLink[] = [
  { href: "/compliance/dpdpa", title: "DPDP Act", description: "The 2023 Act and the 2025 Rules." },
  { href: "/compliance/gdpr", title: "GDPR and UK GDPR", description: "Prior consent, equal choices, records." },
  { href: "/compliance/ccpa", title: "CCPA and CPRA", description: "Opt-out of sale and sharing, Global Privacy Control." },
];

/** Compliance lives here only: by regulation and by industry. */
export const SOLUTIONS: NavMenu = {
  id: "solutions",
  label: "Solutions",
  groups: [
    { heading: "By regulation", links: COMPLIANCE_LINKS, viewAll: { href: "/compliance", title: "View all regulations" } },
    { heading: "By industry", links: INDUSTRY_LINKS.slice(0, 3) },
    { heading: " ", links: INDUSTRY_LINKS.slice(3), viewAll: { href: "/industries", title: "View all industries" } },
  ],
};

export const RESOURCE_LINKS: NavLink[] = [
  { href: "/docs", title: "Documentation" },
  { href: "/security", title: "Security" },
];

export const RESOURCES: NavMenu = {
  id: "resources",
  label: "Resources",
  groups: [{ heading: "Learn", links: RESOURCE_LINKS }],
};

export const MENUS: NavMenu[] = [PLATFORM, SOLUTIONS, RESOURCES];

/** The contact page: the outlined button on the right of the bar. */
export const CONTACT: NavLink = { href: "/contact", title: "Contact" };

/** Every link of a menu, flat: for the phone menu and the footer. */
export const flatLinks = (m: NavMenu): NavLink[] => m.groups.flatMap((g) => [...g.links, ...(g.viewAll ? [g.viewAll] : [])]);

export const LEGAL: NavLink[] = [
  { href: "/legal/privacy", title: "Privacy policy" },
  { href: "/legal/terms", title: "Terms of service" },
  { href: "/legal/cookies", title: "Cookie policy" },
  { href: "/legal/credits", title: "Image credits" },
];
