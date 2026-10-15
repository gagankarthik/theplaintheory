/**
 * Industry pages (/industries/[slug]). Each one says what consent looks like in that kind of business
 * and which Plain Theory capabilities answer it. Content is general product information, not legal
 * advice, and names no customers: every capability listed here exists in the product today.
 */

import type { ComplianceSlug } from "./marketing-routes";

export interface Capability {
  title: string;
  body: string;
  /** where to read more */
  href: string;
}

export interface Industry {
  slug: string;
  name: string;
  /** short form for menus */
  menu: string;
  /** one line for menus and cards */
  summary: string;
  title: string;
  lead: string;
  challenges: { title: string; body: string }[];
  capabilities: Capability[];
  laws: ComplianceSlug[];
  /** a sentence on rules beyond the general privacy laws, kept non-committal on purpose */
  sectorNote: string;
}

const CAP = {
  blocking: { title: "Trackers held until consent", body: "Scripts you mark and trackers the database recognises wait in place until the visitor turns their category on.", href: "/#blocking" },
  scanner: { title: "Cookie scanner", body: "Visits your website as a first-time visitor and lists every cookie, stored value and tracking pixel it finds, including the hidden ones.", href: "/#inside" },
  log: { title: "Tamper-evident consent records", body: "Every choice is saved and chained to the one before it, so you can prove consent to an auditor and any change would show.", href: "/#how" },
  leaks: { title: "Leak alerts", body: "If a tracker fires after a visitor declines, it shows up with the page and the script, so it can be fixed.", href: "/#inside" },
  gcm: { title: "Google Consent Mode v2", body: "Ad and analytics tags receive the visitor's choice the moment it is made.", href: "/docs#consent-mode" },
  gpc: { title: "Global Privacy Control", body: "A browser's GPC signal is honoured as an opt-out of sale and sharing.", href: "/compliance/ccpa" },
  languages: { title: "Notices in 22 Indian languages", body: "The notice is shown in the visitor's language, from Assamese to Urdu, on paid plans.", href: "/compliance/dpdpa" },
  regions: { title: "Region rules", body: "The visitor's location decides which law's notice and defaults they get.", href: "/docs#regions" },
  evidence: { title: "Evidence Pack", body: "One export with the banner you showed, the signals you honoured and the receipts, for an auditor or regulator.", href: "/security" },
  webhooks: { title: "Withdrawal webhooks", body: "Signed webhooks tell your CRM and tools when someone withdraws consent, on the Business plan.", href: "/docs" },
  team: { title: "Teams and roles", body: "Owners, admins, editors, auditors and viewers, with an audit trail of who changed what.", href: "/security" },
  residency: { title: "Data stored in Mumbai", body: "Consent records live in AWS ap-south-1 by default. EU or US residency is available on Enterprise, by arrangement.", href: "/security" },
} satisfies Record<string, Capability>;

export const INDUSTRIES: Industry[] = [
  {
    slug: "ecommerce-retail",
    name: "E-commerce and retail",
    menu: "E-commerce and retail",
    summary: "Ad pixels, retargeting and checkout scripts, held until shoppers agree.",
    title: "Consent for online stores",
    lead: "Stores run more marketing tags than almost any other site: ad pixels, retargeting, reviews, chat and payment scripts. Plain Theory keeps the ones that track waiting until a shopper says yes, without touching checkout.",
    challenges: [
      { title: "Pixels on every page", body: "Ad and retargeting pixels are usually added through a tag manager or a theme and fire on page load, before anyone has chosen." },
      { title: "Checkout must keep working", body: "Payment, fraud and cart scripts are essential. Blocking them by mistake costs orders; leaving trackers beside them costs trust." },
      { title: "Apps add scripts quietly", body: "Store apps and plugins add their own scripts and cookies, so the inventory changes without anyone deciding it." },
    ],
    capabilities: [CAP.blocking, CAP.gcm, CAP.scanner, CAP.leaks, CAP.regions, CAP.log],
    laws: ["gdpr", "ccpa", "dpdpa"],
    sectorNote: "Marketing and consumer-protection rules may also apply to how you collect and use shopper data. Check with your counsel.",
  },
  {
    slug: "saas-technology",
    name: "SaaS and technology",
    menu: "SaaS and technology",
    summary: "Product analytics and growth tools on marketing sites and in the app.",
    title: "Consent for software companies",
    lead: "Software companies run analytics, session replay and growth tools on the marketing site and inside the product. Plain Theory covers both, with SDKs for the frameworks your app is built on.",
    challenges: [
      { title: "Two surfaces, one policy", body: "The marketing site and the signed-in app often load different tools, but visitors expect one consent decision to hold across both." },
      { title: "Replay and product analytics", body: "Session replay and event analytics can record what people type and click, so they belong behind a clear choice." },
      { title: "Customers ask for proof", body: "Security reviews from enterprise buyers increasingly ask how you collect and record consent on your own sites." },
    ],
    capabilities: [CAP.blocking, CAP.scanner, CAP.log, CAP.evidence, CAP.webhooks, CAP.team],
    laws: ["gdpr", "ccpa", "dpdpa"],
    sectorNote: "Contracts with your customers may set their own requirements for subprocessors and data location.",
  },
  {
    slug: "healthcare",
    name: "Healthcare and wellness",
    menu: "Healthcare and wellness",
    summary: "Sensitive pages where an ad pixel can reveal more than a click.",
    title: "Consent for healthcare and wellness sites",
    lead: "On a clinic, pharmacy or wellness site, which page someone visits can itself be sensitive. Plain Theory holds tracking until the visitor agrees and shows you exactly what fired, and where.",
    challenges: [
      { title: "Pages reveal conditions", body: "An ad pixel on a page about a condition or a booking form can send more than a page view to a third party." },
      { title: "Inherited tags", body: "Sites built by agencies often carry tags nobody on the team remembers adding." },
      { title: "Proof matters", body: "When someone asks what was collected about them, you need a record of what they agreed to and when." },
    ],
    capabilities: [CAP.scanner, CAP.blocking, CAP.leaks, CAP.log, CAP.languages, CAP.residency],
    laws: ["gdpr", "ccpa", "dpdpa"],
    sectorNote: "Health information is often covered by sector rules in addition to general privacy law. Plain Theory does not make a site compliant with them on its own; check with your counsel.",
  },
  {
    slug: "financial-services",
    name: "Financial services and fintech",
    menu: "Financial services",
    summary: "Regulated businesses that answer to auditors and keep records for years.",
    title: "Consent for banks, lenders and fintech",
    lead: "Financial businesses keep records for years and answer to auditors. Plain Theory keeps every consent decision in a log that can be verified end to end, for up to seven years on Business and ten on Enterprise.",
    challenges: [
      { title: "Long retention", body: "Records may need to be kept for years, and still be shown to be complete and unchanged when someone asks." },
      { title: "Third-party scripts near forms", body: "Application and onboarding forms are where an unnoticed tracker does the most damage." },
      { title: "Many people, clear roles", body: "Marketing, compliance and engineering all touch the banner; changes need an owner and a trail." },
    ],
    capabilities: [CAP.log, CAP.evidence, CAP.team, CAP.leaks, CAP.webhooks, CAP.residency],
    laws: ["gdpr", "ccpa", "dpdpa"],
    sectorNote: "Financial regulators may set their own record-keeping and outsourcing rules. Check with your counsel.",
  },
  {
    slug: "media-publishing",
    name: "Media and publishing",
    menu: "Media and publishing",
    summary: "Ad-funded sites with many tags and readers in many countries.",
    title: "Consent for publishers",
    lead: "Ad-funded sites load more third-party tags than anyone and have readers everywhere. Plain Theory shows each reader the notice for their region and passes their choice straight to Google's tags.",
    challenges: [
      { title: "Readers from everywhere", body: "A single article can be read under GDPR, CCPA and the DPDP Act on the same day." },
      { title: "Speed is revenue", body: "A heavy consent script slows every page view. Ours is under 10 KB gzipped, and the build fails if it grows past that." },
      { title: "Embeds track too", body: "Video, social and comment embeds set their own cookies the moment they load." },
    ],
    capabilities: [CAP.regions, CAP.gcm, CAP.gpc, CAP.blocking, CAP.scanner, CAP.languages],
    laws: ["gdpr", "ccpa", "dpdpa"],
    sectorNote: "Advertising industry frameworks may apply to how ads are bought and sold on your site.",
  },
  {
    slug: "education",
    name: "Education",
    menu: "Education",
    summary: "Schools, colleges and course platforms with students and parents as visitors.",
    title: "Consent for education",
    lead: "Schools, colleges and course platforms are visited by students and parents, often in several languages. Plain Theory gives them a plain notice in their own language and keeps the record of what they chose.",
    challenges: [
      { title: "Younger visitors", body: "Some visitors are children, and privacy laws treat their data with extra care." },
      { title: "Many languages", body: "Families read in many languages; a notice they can't read isn't informed consent." },
      { title: "Small teams", body: "Most institutions don't have a privacy engineer, so setup has to be simple and the defaults safe." },
    ],
    capabilities: [CAP.languages, CAP.blocking, CAP.scanner, CAP.log, CAP.regions, CAP.residency],
    laws: ["gdpr", "ccpa", "dpdpa"],
    sectorNote: "Children's data is subject to extra rules under the DPDP Act and other laws. Plain Theory does not verify ages or parental consent; check with your counsel.",
  },
];

export const industryBySlug = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);
