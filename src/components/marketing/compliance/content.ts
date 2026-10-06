import type { ComplianceSlug } from "@/lib/marketing-routes";

export interface Requirement {
  title: string;
  body: string;
  /** Source reference shown under the requirement */
  source?: string;
}

export interface Mapping {
  requirement: string;
  feature: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface ComplianceContent {
  slug: ComplianceSlug;
  name: string;
  /** used in <title> and the h1 */
  title: string;
  description: string;
  lead: string;
  appliesTo: { label: string; value: string }[];
  requirements: Requirement[];
  mappings: Mapping[];
  /** optional extra section, e.g. the DPDPA timeline or GPC */
  extra?: { title: string; body: string[]; items?: { term: string; detail: string }[] };
  faq: FaqEntry[];
}

export const COMPLIANCE: Record<ComplianceSlug, ComplianceContent> = {
  gdpr: {
    slug: "gdpr",
    name: "GDPR",
    title: "GDPR cookie consent, explained plainly",
    description:
      "What GDPR and ePrivacy require for cookie consent, and how Plain Theory meets each rule: prior opt-in, an equal reject, easy withdrawal and records of consent.",
    lead: "In the EU, EEA and UK, non-essential cookies and trackers need a visitor's permission before they run. Here's what valid consent looks like and how Plain Theory gets you there.",
    appliesTo: [
      { label: "Who", value: "Any site with visitors in the EU, EEA or UK, wherever the business is based" },
      { label: "Model", value: "Opt-in: nothing non-essential runs until the visitor agrees" },
      { label: "Laws", value: "GDPR, UK GDPR and the ePrivacy Directive (national cookie laws)" },
    ],
    requirements: [
      {
        title: "Ask before anything runs",
        body: "The ePrivacy rules require consent before storing or reading information on a visitor's device, unless it's strictly necessary for a service they asked for. Analytics, advertising and most third-party embeds are not strictly necessary.",
        source: "ePrivacy Directive, Art. 5(3)",
      },
      {
        title: "Consent must be a clear, free choice",
        body: "Consent has to be freely given, specific, informed and unambiguous, and shown by a clear affirmative action. Pre-ticked boxes, scrolling or carrying on browsing don't count.",
        source: "GDPR Art. 4(11); CJEU Planet49 (C-673/17)",
      },
      {
        title: "Rejecting is as easy as accepting",
        body: "European regulators treat a banner with a prominent Accept button and a hidden or harder Reject path as invalid. The choice to say no must be just as visible and take no more steps.",
        source: "EDPB Guidelines 05/2020 and 03/2022 on deceptive design",
      },
      {
        title: "Purposes are explained separately",
        body: "Visitors should see what each category is for and be able to agree to some and not others. A single take-it-or-leave-it switch for everything isn't specific consent.",
        source: "GDPR Art. 7(2)",
      },
      {
        title: "Withdrawal is always available",
        body: "People must be able to withdraw consent at any time, and withdrawing must be as easy as giving it. In practice that means a persistent way back into the choices.",
        source: "GDPR Art. 7(3)",
      },
      {
        title: "You can prove it",
        body: "The controller has to be able to demonstrate that a person consented: what they were shown, what they chose and when.",
        source: "GDPR Art. 7(1)",
      },
    ],
    mappings: [
      { requirement: "Prior consent", feature: "Trackers are held by the script until the matching category is accepted" },
      { requirement: "Clear affirmative action", feature: "No pre-ticked categories; opt-in model for EU, EEA and UK visitors" },
      { requirement: "Reject as easy as accept", feature: "Equal-weight buttons on by default; the builder warns if you turn them off" },
      { requirement: "Specific purposes", feature: "Per-category switches with plain-language descriptions you can edit" },
      { requirement: "Easy withdrawal", feature: "A persistent Privacy choices button and PlainConsent.revoke()" },
      { requirement: "Records of consent", feature: "Hash-chained receipts with notice version, choice and time; CSV and audit report" },
    ],
    faq: [
      {
        q: "Do we need consent for analytics?",
        a: "In most EU countries, yes. Some regulators allow narrowly configured, first-party audience measurement without consent, but standard Google Analytics setups need it. Plain Theory puts analytics in its own category so visitors can decide.",
      },
      {
        q: "Can we show a 'cookie wall' that blocks the site until people accept?",
        a: "Generally no. Regulators consider access conditional on consent to trackers not to be freely given. Plain Theory's banner never blocks the page behind it.",
      },
      {
        q: "How long is consent valid?",
        a: "GDPR doesn't set a period, but many regulators recommend asking again after six to thirteen months. Plain Theory re-asks after the expiry you set (180 days by default) and whenever you publish a new version of the notice.",
      },
    ],
  },

  ccpa: {
    slug: "ccpa",
    name: "CCPA/CPRA",
    title: "CCPA and CPRA opt-out, done right",
    description:
      "What CCPA and CPRA require for cookies and trackers: notice at collection, a Do Not Sell or Share link, Global Privacy Control and limits on sensitive data.",
    lead: "California uses an opt-out model. Trackers can run by default, but visitors must be told and given a clear way to stop the sale or sharing of their information, including through their browser.",
    appliesTo: [
      { label: "Who", value: "For-profit businesses meeting a CCPA threshold, such as $25M+ annual revenue (adjusted for inflation)" },
      { label: "Model", value: "Opt-out: allowed until the visitor objects, with stricter rules for sensitive data and minors" },
      { label: "Laws", value: "California Consumer Privacy Act as amended by CPRA, and CPPA regulations" },
    ],
    requirements: [
      {
        title: "Notice at collection",
        body: "At or before the point information is collected, tell people what categories you collect, why, and whether it's sold or shared. A banner or footer link to that notice works for cookies.",
        source: "Cal. Civ. Code §1798.100; CCPA Regs §7012",
      },
      {
        title: "A Do Not Sell or Share link",
        body: "If advertising cookies send data to third parties for cross-context behavioural advertising, that's selling or sharing. You must offer a clear Do Not Sell or Share My Personal Information link or an equivalent alternative opt-out.",
        source: "Cal. Civ. Code §1798.120, §1798.135",
      },
      {
        title: "Honour Global Privacy Control",
        body: "Browsers and extensions can send an opt-out preference signal. Businesses must treat it as a valid request to opt out of sale and sharing for that browser.",
        source: "CCPA Regs §7025",
      },
      {
        title: "Limit use of sensitive information",
        body: "Precise location, health and other sensitive data come with a right to limit its use. Don't load trackers that infer sensitive traits without offering that choice.",
        source: "Cal. Civ. Code §1798.121",
      },
      {
        title: "No dark patterns",
        body: "Opting out must take no more steps than opting in, and the choices must be symmetrical in wording and design. Agreement obtained through dark patterns isn't consent.",
        source: "CCPA Regs §7004",
      },
    ],
    mappings: [
      { requirement: "Notice at collection", feature: "California-specific notice copy with a link to your privacy notice" },
      { requirement: "Do Not Sell or Share", feature: "The reject action is labelled 'Do not sell or share my info' for California visitors" },
      { requirement: "Global Privacy Control", feature: "navigator.globalPrivacyControl is read on every page and opts out of marketing" },
      { requirement: "Opt-out model", feature: "Region rules start California visitors opted in and switch trackers off on request" },
      { requirement: "Symmetrical choices", feature: "Equal-weight buttons and the same number of steps both ways" },
      { requirement: "Record of requests", feature: "Every opt-out is logged as a receipt with time and notice version" },
    ],
    extra: {
      title: "How Global Privacy Control works",
      body: [
        "Global Privacy Control is a single signal a browser sends with every request and exposes to scripts. Firefox, Brave and DuckDuckGo support it, and extensions add it to other browsers.",
        "Plain Theory checks for the signal before any marketing tracker is released. When it's present, marketing stays off for that browser, even in an opt-out region where it would otherwise start on.",
      ],
    },
    faq: [
      {
        q: "Does an analytics cookie count as selling?",
        a: "First-party analytics used only for your own measurement usually isn't a sale or share. Sending data to an ad platform for targeting across sites is. Put each tracker in the right category and the banner handles the rest.",
      },
      {
        q: "Do other US states work the same way?",
        a: "Colorado, Connecticut, Virginia, Texas and others have similar opt-out laws, and several also require honouring universal opt-out signals. The opt-out notice and GPC handling apply to them too; you can extend region rules to those states.",
      },
      {
        q: "Do we need a banner at all in California?",
        a: "Not necessarily a pop-up, but you need notice at collection and an easy opt-out. Many sites use a compact banner on first visit plus a persistent link. Plain Theory supports both.",
      },
    ],
  },

  dpdpa: {
    slug: "dpdpa",
    name: "DPDPA",
    title: "DPDPA consent readiness for India",
    description:
      "What India's DPDP Act 2023 and DPDP Rules 2025 require for consent: itemised notices, a clear affirmative act, easy withdrawal and DPO contacts.",
    lead: "India's Digital Personal Data Protection Act, 2023 makes consent the main basis for processing personal data. The DPDP Rules, 2025 set out how notices must look and when each duty starts.",
    appliesTo: [
      { label: "Who", value: "Anyone processing digital personal data in India, or offering goods or services to people in India" },
      { label: "Model", value: "Opt-in: consent must be given by a clear affirmative action before processing" },
      { label: "Laws", value: "Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025" },
    ],
    requirements: [
      {
        title: "An itemised notice in plain language",
        body: "Before asking for consent, give a notice that stands on its own, lists the personal data and the specific purpose for each item, and is written clearly enough to understand without reading anything else.",
        source: "DPDP Act s.5; DPDP Rules, Rule 3",
      },
      {
        title: "Consent that is free and specific",
        body: "Consent must be free, specific, informed, unconditional and unambiguous, given by a clear affirmative action, and limited to the data needed for the stated purpose.",
        source: "DPDP Act s.6(1)",
      },
      {
        title: "Withdrawal as easy as giving",
        body: "People can withdraw consent at any time, and doing so must be comparably easy to giving it. Once withdrawn, processing for that purpose has to stop within a reasonable time.",
        source: "DPDP Act s.6(4)-(6)",
      },
      {
        title: "Who to contact",
        body: "The notice must say how to exercise rights and how to complain to the Data Protection Board, and give the contact details of the Data Protection Officer or the person who answers on your behalf.",
        source: "DPDP Act s.5(1); s.8(9)",
      },
      {
        title: "Consent Managers",
        body: "People can give, manage and withdraw consent through a registered Consent Manager. Your systems should accept consent recorded that way as well as directly.",
        source: "DPDP Act s.6(7)-(9); DPDP Rules, Rule 4",
      },
      {
        title: "Keep records and protect them",
        body: "Data Fiduciaries must be able to show that notice was given and consent obtained, and must take reasonable security safeguards. Breaches can attract penalties of up to ₹250 crore.",
        source: "DPDP Act s.6(10), s.8(5); Schedule",
      },
    ],
    mappings: [
      { requirement: "Itemised notice (Rule 3)", feature: "Each purpose lists its own data items and retention, edited in the banner builder and shown in the notice" },
      { requirement: "Notice in 22 languages (s.5(3))", feature: "Drafts for all 22 Eighth Schedule languages, each marked draft or reviewed by a named person" },
      { requirement: "Clear affirmative action (s.6)", feature: "Nothing non-essential runs until the visitor chooses; no pre-ticked purposes" },
      { requirement: "Withdrawal as easy as giving (s.6(4))", feature: "A persistent Privacy choices button reopens the purposes; one tap withdraws, and signed webhooks tell your systems" },
      { requirement: "Rights, grievance and Board complaint", feature: "Rights page, grievance email and Data Protection Board link set once and shown in every DPDPA notice" },
      { requirement: "DPO or contact person", feature: "Your DPO's name and email from Settings appear inside the notice" },
      { requirement: "Proof of notice and consent (s.6(10))", feature: "Hash-chained receipts with the notice version and language, verifiable on demand, exported as an Evidence Pack" },
      { requirement: "Processing actually stops", feature: "Leak alerts report any tracker that still fires after a person declines, page by page" },
      { requirement: "Records kept long enough (Rule 6)", feature: "1-year log on Starter, 2 years on Growth, 7 years on Business" },
      { requirement: "Data localisation choice", feature: "Store receipts in Mumbai (ap-south-1) or Hyderabad (ap-south-2)" },
    ],
    extra: {
      title: "When each duty applies",
      body: [
        "The DPDP Rules, 2025 were notified on 13 November 2025 and come into force in phases. MeitY has consulted on bringing the May 2027 date forward to 13 November 2026; as of October 2026 that change has not been notified in the Gazette.",
      ],
      items: [
        { term: "13 November 2025", detail: "Rules notified; provisions setting up the Data Protection Board in force." },
        { term: "13 November 2026", detail: "Registration and obligations of Consent Managers begin (Rule 4)." },
        { term: "13 May 2027", detail: "Notice, consent, withdrawal, security safeguards, breach reporting, retention, children's data and Data Principal rights become enforceable." },
      ],
    },
    faq: [
      {
        q: "Does DPDPA apply to cookies?",
        a: "DPDPA covers personal data in digital form. Identifiers set by cookies and trackers, combined with browsing behaviour, are personal data when they relate to an identifiable person. Treat analytics and advertising trackers as needing consent.",
      },
      {
        q: "Do we need a Data Protection Officer?",
        a: "Only Significant Data Fiduciaries must appoint a DPO based in India. Everyone else must still name a person who answers questions about data processing. Plain Theory shows whichever contact you set.",
      },
      {
        q: "Does our consent tool need to register with the Data Protection Board?",
        a: "No. Only Consent Managers register with the Board. A consent management platform that a business runs on its own site doesn't. Using a registered Consent Manager is optional for businesses, though you must accept consent given through one.",
      },
      {
        q: "Are machine translations enough for the 22 languages?",
        a: "Treat them as a starting point. The notice has to be clear to the person reading it, so have a native speaker check each language before you rely on it. Plain Theory records who reviewed each one and when.",
      },
      {
        q: "Is data localisation required?",
        a: "The Act doesn't require all data to stay in India, but the government can restrict transfers to specific countries and sector regulators may have their own rules. Keeping receipts in Mumbai or Hyderabad avoids the question for consent records.",
      },
    ],
  },
};
