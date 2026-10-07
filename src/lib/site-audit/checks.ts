import { KNOWN_TRACKERS } from "../defaults";
import { EIGHTH_SCHEDULE } from "../i18n/languages";
import { extractLinks, extractScripts, hreflangs, htmlLang, isExecutable, quoteAround, type PageLink } from "./html";
import type { PageKind, SiteCheck, SiteCheckEvidence, SiteCheckStatus, SiteNotice, SitePageVisit } from "./types";

/**
 * Detectors for the live site check. Pure: they read pages already fetched, so they can be tested
 * with HTML fixtures. Every detector is conservative: when a page couldn't be read, or the site
 * renders with JavaScript, it says "couldn't check" rather than fail.
 */

export interface AuditPage {
  url: string;
  kind: PageKind;
  html: string;
  /** visible text (htmlToText) */
  text: string;
  /** "guess" when we tried a common path because the homepage didn't link one */
  via?: "link" | "guess";
  /** how strongly its link looked like this kind of page; higher is read first */
  rank?: number;
}

export interface AuditHome extends AuditPage {
  /** Set-Cookie headers from the homepage response (and its redirects) */
  setCookies: string[];
  /** Strict-Transport-Security header, if any */
  hsts: string | null;
}

export interface AuditInput {
  domain: string;
  home: AuditHome | null;
  /** pages other than the homepage that were read */
  pages: AuditPage[];
  visits: SitePageVisit[];
}

/* ---------------- shared helpers ---------------- */

/** Where to look first for policy wording. */
const KIND_ORDER: PageKind[] = ["privacy", "grievance", "contact", "legal", "terms", "cookies", "home"];

function corpus(input: AuditInput): AuditPage[] {
  const all = [...input.pages, ...(input.home ? [input.home] : [])];
  return all.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (b.rank ?? 0) - (a.rank ?? 0));
}

interface Hit {
  page: AuditPage;
  index: number;
  length: number;
  match: RegExpMatchArray;
}

function* hits(pages: AuditPage[], re: RegExp): Generator<Hit> {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const page of pages) {
    for (const m of page.text.matchAll(g)) yield { page, index: m.index ?? 0, length: m[0].length, match: m };
  }
}

function firstHit(pages: AuditPage[], re: RegExp, accept?: (h: Hit) => boolean): Hit | undefined {
  for (const h of hits(pages, re)) if (!accept || accept(h)) return h;
  return undefined;
}

const evidenceOf = (h: Hit): SiteCheckEvidence => ({ url: h.page.url, quote: quoteAround(h.page.text, h.index, h.index + h.length) });
const windowOf = (h: Hit, before = 300, after = 400) => h.page.text.slice(Math.max(0, h.index - before), h.index + h.length + after);

/** A site whose server sends an app shell and builds the page with JavaScript. */
export function isJsRendered(html: string, text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 20) return true;
  // an empty mount point that the app fills in the browser
  const emptyShell = /<div\b[^>]*\bid\s*=\s*["'](?:root|app|__next|__nuxt|___gatsby|svelte)["'][^>]*>\s*<\/div>/i.test(html);
  return words < 60 && emptyShell;
}

/** Whether we read something that looks like a privacy notice, so a "not found" can be trusted. */
export function hasReadableNotice(input: AuditInput) {
  const policyish = input.pages.some((p) => ["privacy", "grievance", "legal"].includes(p.kind) && p.text.length > 400);
  const home = input.home;
  const onePager = !!home && home.text.length > 2500 && /privacy (?:policy|notice|statement)|personal data/i.test(home.text);
  return policyish || onePager;
}

export function isIndiaTargeted(input: AuditInput) {
  const host = input.domain.toLowerCase();
  if (/\.in$/.test(host)) return true;
  const html = input.home?.html ?? "";
  const lang = htmlLang(html) ?? "";
  if (/^hi\b|-in$/.test(lang)) return true;
  if (hreflangs(html).some((h) => /-in$/.test(h) || EIGHTH_SCHEDULE.some((l) => h === l.code || h.startsWith(`${l.code}-`)))) return true;
  return /₹|\bINR\b|\bRs\.?\s?\d/.test(input.home?.text ?? "");
}

const NOT_READ = "We couldn't read your privacy notice, so we couldn't check this.";

function unknownCheck(base: Omit<SiteCheck, "status" | "finding">, finding = NOT_READ): SiteCheck {
  return { ...base, status: "unknown", finding };
}

/* ---------------- privacy notice ---------------- */

const PRIVACY_LINK = /privacy|datenschutz|confidentialit|privacidad|गोपनीयता/i;
const PRIVACY_CHOICES = /privacy (?:choices|settings|preferences|centre|center)$|do not sell|cookie settings/i;

export function privacyLinks(links: PageLink[]): PageLink[] {
  return links
    .filter((l) => (PRIVACY_LINK.test(l.text) || PRIVACY_LINK.test(new URL(l.href).pathname)) && !PRIVACY_CHOICES.test(l.text.trim()))
    .sort((a, b) => Number(/policy|notice|statement/i.test(b.text + b.href)) - Number(/policy|notice|statement/i.test(a.text + a.href)));
}

function checkPrivacyNotice(input: AuditInput, spa: boolean): SiteCheck {
  const base = {
    id: "privacy-notice" as const,
    title: "Privacy notice linked from the homepage",
    ref: "DPDP Act s.5; Rules 2025, Rule 3",
    fix: "Add a link called “Privacy notice” or “Privacy policy” to the footer of every page.",
  };
  const home = input.home;
  if (!home) return unknownCheck(base, "We couldn't load your homepage.");
  const link = privacyLinks(extractLinks(home.html, home.url))[0];
  const guessed = input.pages.find((p) => p.kind === "privacy" && p.via === "guess" && p.text.length > 400);
  if (link) {
    const visit = input.visits.find((v) => v.url === link.href);
    if (visit && visit.status !== null && visit.status >= 400) {
      return { ...base, status: "warn", finding: `Your homepage links to a privacy notice, but that page answered with HTTP ${visit.status}.`, evidence: { url: link.href, quote: link.text || undefined } };
    }
    return { ...base, status: "pass", finding: `Linked as “${link.text || new URL(link.href).pathname}”.`, evidence: { url: link.href, quote: link.text || undefined }, fix: undefined };
  }
  if (guessed) {
    return {
      ...base,
      status: "warn",
      finding: "You have a privacy notice, but we couldn't find a link to it on your homepage.",
      evidence: { url: guessed.url },
    };
  }
  if (spa) return unknownCheck(base, "Your homepage builds its links with JavaScript, so we couldn't see them.");
  return { ...base, status: "fail", finding: "We couldn't find a link to a privacy notice on your homepage." };
}

/* ---------------- grievance contact ---------------- */

const DESIGNATION = /grievance (?:redressal )?officer|data protection officer|nodal officer|privacy officer|grievance redressal|\bDPO\b/gi;
const EMAIL = /[A-Z0-9._%+-]+(?:@|\s?\[at\]\s?|\s?\(at\)\s?)[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;
const FORM = /(?:contact|grievance|complaint|request|web)[ -]?form|fill (?:out|in) (?:the|this|our) form|submit (?:a|your) (?:request|complaint|grievance)|raise (?:a |your )?(?:ticket|grievance|complaint)/i;
const PRIVACY_EMAIL = /\b(?:privacy|dpo|grievance|dataprotection|data\.protection|gdpr|legal)@[a-z0-9.-]+\.[a-z]{2,}/i;

function checkGrievanceContact(input: AuditInput, pages: AuditPage[], notice: boolean): SiteCheck {
  const base = {
    id: "grievance-contact" as const,
    title: "Grievance Officer or DPO contact published",
    ref: "DPDP Act s.8(10); Rules 2025, Rule 9",
  };
  let named: Hit | undefined;
  for (const h of hits(pages, DESIGNATION)) {
    // "DPO" must be the capitalised abbreviation, not part of a word or a URL
    if (h.match[0] === "dpo" || h.match[0] === "Dpo") continue;
    named ??= h;
    const near = windowOf(h);
    if (EMAIL.test(near) || FORM.test(near)) {
      const contact = near.match(EMAIL)?.[0];
      return {
        ...base,
        status: "pass",
        finding: contact ? `Published with an email address (${contact.replace(/\s/g, "")}).` : "Published with a form to reach them.",
        evidence: evidenceOf(h),
      };
    }
  }
  const fixText = "Name your Grievance Officer or Data Protection Officer (a name or designation is enough) with an email address or form, in your privacy notice.";
  const action = { label: "Add a grievance contact", target: "settings:dpo" as const };
  if (named) {
    return { ...base, status: "warn", finding: "We found a mention of a grievance officer or DPO, but no email address or form next to it.", evidence: evidenceOf(named), fix: fixText, action };
  }
  const generic = firstHit(pages, PRIVACY_EMAIL);
  if (generic) {
    return {
      ...base,
      status: "warn",
      finding: `We found ${generic.match[0]}, but not who it reaches. Say it reaches your Grievance Officer or DPO.`,
      evidence: evidenceOf(generic),
      fix: fixText,
      action,
    };
  }
  if (!notice) return unknownCheck({ ...base, fix: fixText, action });
  return { ...base, status: "fail", finding: "We couldn't find a Grievance Officer or DPO contact on the pages we read.", fix: fixText, action };
}

/* ---------------- grievance timeline ---------------- */

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, "forty-five": 45, "forty five": 45, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const NUM = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join("|")})`;
const PERIOD = new RegExp(
  `\\b(?:within|in|no later than|not later than|not exceeding|not more than|up ?to|a maximum of|maximum of)\\s+(?:a (?:period|maximum) of\\s+)?(?:an?\\s+)?${NUM}(?:\\s*\\(\\d{1,3}\\))?\\s*(calendar\\s+|working\\s+|business\\s+)?(days?|weeks?|months?)\\b`,
  "gi",
);
const STRONG_CONTEXT = /grievance|complain|redress/i;
const WEAK_CONTEXT = /request|respond|resolv|reply|acknowledg/i;

/** Days in a matched period ("within 30 days", "within one month", "15 working days"). */
export function periodDays(m: RegExpMatchArray): number | null {
  const raw = m[1].toLowerCase();
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
  if (!n) return null;
  const unit = m[3].toLowerCase();
  const base = unit.startsWith("day") ? n : unit.startsWith("week") ? n * 7 : n * 30;
  // working days run longer than calendar days
  return m[2] && /working|business/i.test(m[2]) ? Math.ceil((base * 7) / 5) : base;
}

function checkGrievanceTimeline(pages: AuditPage[], notice: boolean): SiteCheck {
  const base = {
    id: "grievance-timeline" as const,
    title: "Says grievances are answered within 90 days",
    ref: "DPDP Rules 2025, Rule 14(3)",
    fix: "State in your privacy notice that you respond to grievances within 90 days at most (a shorter period, such as 30 days, is better).",
  };
  const found: { hit: Hit; days: number; strong: boolean }[] = [];
  for (const h of hits(pages, PERIOD)) {
    const days = periodDays(h.match);
    if (days === null) continue;
    const near = windowOf(h, 250, 150);
    const strong = STRONG_CONTEXT.test(near);
    if (strong || WEAK_CONTEXT.test(near)) found.push({ hit: h, days, strong });
  }
  const pool = found.some((f) => f.strong) ? found.filter((f) => f.strong) : found;
  if (pool.length) {
    const best = pool.reduce((a, b) => (b.days < a.days ? b : a));
    const what = best.strong ? "grievances" : "requests";
    const said = best.hit.match[0].replace(/^\w+\s+/, "").trim();
    if (best.days <= 90) return { ...base, status: "pass", finding: `Says ${what} are answered within ${said}.`, evidence: evidenceOf(best.hit), fix: undefined };
    return { ...base, status: "warn", finding: `Says ${what} are answered within ${said}, which is longer than 90 days.`, evidence: evidenceOf(best.hit) };
  }
  if (!notice) return unknownCheck(base);
  return { ...base, status: "warn", finding: "Your notice doesn't say how quickly you answer grievances." };
}

/* ---------------- rights ---------------- */

const RIGHTS: { key: string; label: string; re: RegExp }[] = [
  {
    key: "access",
    label: "access (a summary of their data)",
    re: /right (?:to|of) access|access (?:to )?(?:your|the|their) (?:personal )?(?:data|information)|summary of (?:the |your )?personal data|(?:request|obtain|get|receive) a copy of (?:your |the )?(?:personal )?(?:data|information)/i,
  },
  {
    key: "correction",
    label: "correction",
    re: /right (?:to|of) (?:correct|rectif|updat|complet)|rectif(?:y|ication)|correct(?:ion of|ing)? (?:your |any |the )?(?:inaccurate |incomplete )?(?:personal )?(?:data|information)|update (?:your |any )?(?:inaccurate |incomplete )(?:personal )?(?:data|information)|ask (?:us )?to (?:correct|rectify)|\b(?:correct|rectify)(?:,|\s+or|\s+and)\s+(?:complete|update|erase|delete)/i,
  },
  { key: "erasure", label: "erasure", re: /erasure|right (?:to|of) (?:eras|delet|be forgotten)|(?:erase|delete|deletion of) (?:your |the |their )?(?:personal )?(?:data|information)|\b(?:or|and) (?:erase|delete) (?:it|them)\b/i },
  { key: "nomination", label: "nomination", re: /\bnominat(?:e|ion|ing)\b[^.\n]{0,160}\b(?:individual|person|death|incapacity|right|behalf)|\bright to nominat/i },
];

function checkRights(pages: AuditPage[], notice: boolean): SiteCheck {
  const base = {
    id: "rights" as const,
    title: "Describes data principals' rights",
    ref: "DPDP Act ss.11–14; Rules 2025, Rule 3(c)",
    fix: "List the rights to access a summary of personal data, correct and erase it, and nominate someone, and say how to use them.",
    action: { label: "Set rights links", target: "regions:notice" as const },
  };
  const present = RIGHTS.map((r) => ({ ...r, hit: firstHit(pages, r.re) })).filter((r) => r.hit);
  const missing = RIGHTS.filter((r) => !present.some((p) => p.key === r.key)).map((r) => r.label);
  if (present.length === RIGHTS.length) return { ...base, status: "pass", finding: "Covers access, correction, erasure and nomination.", evidence: evidenceOf(present[0].hit!), fix: undefined, action: undefined };
  if (present.length) {
    return {
      ...base,
      status: "warn",
      finding: `Mentions ${present.map((p) => p.key).join(", ")}, but not ${missing.join(" or ")}.`,
      evidence: evidenceOf(present[0].hit!),
      items: missing.map((m) => `Missing: ${m}`),
    };
  }
  if (!notice) return unknownCheck(base);
  return { ...base, status: "fail", finding: "We couldn't find a description of visitors' rights." };
}

/* ---------------- Data Protection Board ---------------- */

function checkBoard(input: AuditInput, pages: AuditPage[], notice: boolean, india: boolean): SiteCheck {
  const base = {
    id: "board-complaint" as const,
    title: "Mentions complaints to the Data Protection Board",
    ref: "DPDP Act s.13(2); Rules 2025, Rule 3(c)(iii)",
    fix: "Say that people can complain to the Data Protection Board of India if they aren't satisfied with your answer to a grievance.",
    action: { label: "Add Board link", target: "regions:notice" as const },
  };
  const h = firstHit(pages, /Data Protection Board(?: of India)?/i);
  if (h) return { ...base, status: "pass", finding: "Mentions the Data Protection Board of India.", evidence: evidenceOf(h), fix: undefined, action: undefined };
  if (!notice) return unknownCheck(base);
  return {
    ...base,
    status: india ? "fail" : "warn",
    finding: india ? "We couldn't find a mention of the Data Protection Board of India." : "No mention of the Data Protection Board of India. This applies if you serve people in India.",
  };
}

/* ---------------- consent withdrawal ---------------- */

const WITHDRAW = /withdraw(?:al of|ing)? (?:your |their |the |this |such )?consent|revok(?:e|ing) (?:your |their )?consent|consent (?:can|may) be (?:withdrawn|revoked)|withdraw (?:it|this) at any time/i;
const MANAGE = /opt[- ]out|(?:change|update|manage|review) (?:your )?(?:cookie|consent|privacy) (?:preferences|settings|choices)|privacy choices|cookie settings/i;

function checkWithdrawal(pages: AuditPage[], notice: boolean): SiteCheck {
  const base = {
    id: "consent-withdrawal" as const,
    title: "Explains how to withdraw consent",
    ref: "DPDP Act s.6(4); Rules 2025, Rule 3(c)(i)",
    fix: "Explain in your notice that people can withdraw consent at any time, as easily as they gave it, and how (for example the “Privacy choices” button).",
    action: { label: "Review the banner", target: "banner" as const },
  };
  const strong = firstHit(pages, WITHDRAW);
  if (strong) return { ...base, status: "pass", finding: "Explains how to withdraw consent.", evidence: evidenceOf(strong), fix: undefined, action: undefined };
  const weak = firstHit(pages, MANAGE);
  if (weak) return { ...base, status: "warn", finding: "Mentions opting out or changing preferences, but not withdrawing consent.", evidence: evidenceOf(weak) };
  if (!notice) return unknownCheck(base);
  return { ...base, status: "fail", finding: "We couldn't find how to withdraw consent." };
}

/* ---------------- consent tool ---------------- */

const CMPS: { name: string; re: RegExp }[] = [
  { name: "Plain Theory", re: /\/sdk\/(?:v1\/)?plain-consent(?:\.min)?\.js|cdn\.theplaintheory\.in/i },
  { name: "OneTrust", re: /cdn\.cookielaw\.org|optanon|otSDKStub|onetrust/i },
  { name: "Cookiebot", re: /consent\.cookiebot\.com|cookiebot/i },
  { name: "Usercentrics", re: /usercentrics\.eu|app\.usercentrics|usercentrics/i },
  { name: "Didomi", re: /sdk\.privacy-center\.org|didomi/i },
  { name: "CookieYes", re: /cdn-cookieyes\.com|cookieyes/i },
  { name: "Osano", re: /cmp\.osano\.com|osano/i },
  { name: "TrustArc", re: /consent\.trustarc\.com|trustarc|consent-pref\.trustarc/i },
  { name: "Termly", re: /app\.termly\.io|termly/i },
  { name: "Complianz", re: /complianz|cmplz/i },
  { name: "Quantcast Choice", re: /quantcast\.mgr\.consensu\.org|cmp\.quantcast\.com|choice\.quantcast/i },
  { name: "Google consent mode (denied by default)", re: /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"][\s\S]{0,400}?['"]denied['"]/i },
];
const GTM = /googletagmanager\.com\/gtm\.js|googletagmanager\.com\/ns\.html/i;

function scriptHaystack(html: string) {
  return extractScripts(html)
    .map((s) => `${s.src ?? ""}\n${s.inline}`)
    .join("\n")
    .concat("\n", (html.match(/<link\b[^>]*>/gi) ?? []).join("\n"));
}

function checkCmp(home: AuditHome | null, trackers: string[], spa: boolean): SiteCheck {
  const base = {
    id: "cmp-present" as const,
    title: "Consent banner on the homepage",
    ref: "DPDP Act s.6; GDPR Art. 7; ePrivacy Art. 5(3)",
    fix: "Add a consent banner that asks before any analytics or advertising runs.",
    action: { label: "Install Plain Theory", target: "install" as const },
  };
  if (!home) return unknownCheck(base, "We couldn't load your homepage.");
  const hay = scriptHaystack(home.html);
  for (const c of CMPS) {
    const m = hay.match(c.re);
    if (m) {
      // quote the script address when there is one; inline code (or framework payloads) reads as noise
      const src = extractScripts(home.html).find((s) => s.src && c.re.test(s.src))?.src;
      const quote = (src ? `<script src="${src}">` : `Inline script mentions “${m[0].slice(0, 80)}”`).slice(0, 200);
      return { ...base, status: "pass", finding: `${c.name} found.`, evidence: { url: home.url, quote }, fix: undefined, action: undefined };
    }
  }
  if (GTM.test(hay)) return unknownCheck(base, "We didn't see a consent tool in the page, but Google Tag Manager may load one after the page starts.");
  if (spa) return unknownCheck(base, "Your site loads with JavaScript, so a consent tool may be added after the HTML we read.");
  if (trackers.length) return { ...base, status: "fail", finding: "Trackers load on your homepage, but we couldn't find a consent banner." };
  return { ...base, status: "warn", finding: "We couldn't find a consent banner on your homepage." };
}

/* ---------------- trackers in the initial HTML ---------------- */

export function trackersInHtml(html: string): { name: string; evidence: string }[] {
  const scripts = extractScripts(html).filter(isExecutable);
  const srcs = scripts.map((s) => s.src).filter((s): s is string => !!s);
  const inline = scripts.map((s) => s.inline).join("\n");
  const out = new Map<string, { name: string; evidence: string }>();
  for (const t of KNOWN_TRACKERS) {
    const hit = srcs.find((s) => s.includes(t.pattern)) ?? (inline.includes(t.pattern) ? `inline script (${t.pattern})` : undefined);
    if (hit) out.set(t.name, { name: t.name, evidence: hit.slice(0, 200) });
  }
  return [...out.values()];
}

function checkTrackers(home: AuditHome | null, found: { name: string; evidence: string }[], spa: boolean): SiteCheck {
  const base = {
    id: "pre-consent-trackers" as const,
    title: "No trackers before consent",
    ref: "DPDP Act s.6(1); GDPR Art. 6(1)(a); ePrivacy Art. 5(3)",
    fix: "Load these through your consent tool (for example with type=\"text/plain\" and a consent category) so they wait for a yes.",
    action: { label: "Hold trackers", target: "trackers" as const },
  };
  if (!home) return unknownCheck(base, "We couldn't load your homepage.");
  if (found.length) {
    return {
      ...base,
      status: "warn",
      finding: `${found.length} known tracker${found.length > 1 ? "s are" : " is"} in your page's HTML. Unless your consent tool holds ${found.length > 1 ? "them" : "it"} back, ${found.length > 1 ? "they run" : "it runs"} before visitors choose.`,
      items: found.map((f) => f.name),
      evidence: { url: home.url, quote: found[0].evidence },
    };
  }
  if (spa) return unknownCheck(base, "Your site loads its scripts with JavaScript, so we couldn't see which trackers run.");
  return { ...base, status: "pass", finding: "No known trackers in your homepage's HTML.", fix: undefined, action: undefined };
}

/* ---------------- cookies set on first load ---------------- */

const TRACKING_COOKIE = /^(?:_ga|_gid|_gat|_gcl|_gac|_fbp|_fbc|fr|_uet|_uetsid|_uetvid|_clck|_clsk|_hj|mp_|ajs_|_tt_|_ttp|ide|test_cookie|li_|lidc|bcookie|bscookie|_pin|_pinterest|hubspotutk|__hs|_mkto|_scid|_rdt|muid|anj|uuid2|personalization_id)/i;

export function cookieNames(setCookies: string[]) {
  return [...new Set(setCookies.map((c) => c.split(";")[0].split("=")[0].trim()).filter(Boolean))];
}

function checkCookies(home: AuditHome | null): SiteCheck {
  const base = {
    id: "cookies-on-load" as const,
    title: "No tracking cookies on first load",
    ref: "DPDP Act s.6(1); ePrivacy Art. 5(3)",
    fix: "Set these cookies only after visitors agree. If your server sets them, move that behind your consent tool.",
    action: { label: "Hold trackers", target: "trackers" as const },
  };
  if (!home) return unknownCheck(base, "We couldn't load your homepage.");
  const names = cookieNames(home.setCookies);
  const tracking = names.filter((n) => TRACKING_COOKIE.test(n));
  if (tracking.length) {
    return {
      ...base,
      status: "warn",
      finding: `Your server sets ${tracking.length === 1 ? "a cookie that looks" : `${tracking.length} cookies that look`} like tracking before anyone chooses.`,
      items: tracking,
      evidence: { url: home.url, quote: `Set-Cookie: ${tracking.join(", ")}`.slice(0, 200) },
    };
  }
  return {
    ...base,
    status: "pass",
    finding: names.length ? `${names.length} cookie${names.length > 1 ? "s" : ""} set by the server, none that look like tracking.` : "Your server sets no cookies on the homepage.",
    items: names.length ? names : undefined,
    fix: undefined,
    action: undefined,
  };
}

/* ---------------- languages ---------------- */

function checkLanguages(input: AuditInput, india: boolean): SiteCheck {
  const base = {
    id: "languages" as const,
    title: "Languages offered",
    ref: "DPDP Act s.5(3)",
    fix: "Offer your notice in the Eighth Schedule languages your visitors read, such as Hindi.",
    action: { label: "Manage languages", target: "languages" as const },
  };
  const home = input.home;
  if (!home) return unknownCheck(base, "We couldn't load your homepage.");
  const lang = htmlLang(home.html);
  const alternates = hreflangs(home.html).filter((h) => h !== "x-default");
  const linkTexts = extractLinks(home.html, home.url).map((l) => l.text.trim());
  const offered = EIGHTH_SCHEDULE.filter(
    (l) => [lang ?? "", ...alternates].some((h) => h === l.code || h.startsWith(`${l.code}-`)) || linkTexts.includes(l.native),
  ).map((l) => l.name);
  const langText = `${lang ? `Page language: ${lang}.` : "No page language set."}${alternates.length ? ` Alternates: ${alternates.slice(0, 8).join(", ")}${alternates.length > 8 ? "…" : ""}.` : ""}`;
  if (offered.length) {
    return { ...base, status: "pass", finding: `Offers ${offered.join(", ")}. ${langText}`, items: offered, fix: undefined, action: undefined };
  }
  if (india) {
    return { ...base, status: "warn", finding: `Your site looks aimed at India but we found no Eighth Schedule language. ${langText}` };
  }
  return { ...base, status: "pass", finding: langText, fix: undefined, action: undefined };
}

/* ---------------- HTTPS ---------------- */

function checkHttps(home: AuditHome | null): SiteCheck {
  const base = { id: "https" as const, title: "Served over HTTPS", ref: "DPDP Act s.8(5) (reasonable security safeguards)" };
  if (!home) return unknownCheck(base, "We couldn't load your homepage.");
  if (!home.url.startsWith("https:")) {
    return { ...base, status: "fail", finding: "Your homepage is served over plain HTTP.", evidence: { url: home.url }, fix: "Serve the site over HTTPS and redirect HTTP to it." };
  }
  if (home.hsts && /max-age=\s*[1-9]/i.test(home.hsts)) {
    return { ...base, status: "pass", finding: "HTTPS with HSTS.", evidence: { url: home.url, quote: `Strict-Transport-Security: ${home.hsts}`.slice(0, 200) } };
  }
  return {
    ...base,
    status: "warn",
    finding: "HTTPS, but without an HSTS header, so browsers may still try HTTP first.",
    evidence: { url: home.url },
    fix: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains.",
  };
}

/* ---------------- children ---------------- */

const CHILDREN =
  /verifiable (?:parental )?consent|parental consent|consent (?:of|from) (?:a |the |their )?(?:parent|lawful guardian|guardian)|children(?:'s|’s)? (?:personal )?(?:data|information|privacy)|(?:under|below) (?:the age of )?(?:18|eighteen)|\bminors?\b|\bchild(?:ren)?\b[^.\n]{0,80}\b(?:data|information|consent|age)\b/i;

function checkChildren(pages: AuditPage[], notice: boolean): SiteCheck {
  const base = {
    id: "children" as const,
    title: "Covers children's data",
    ref: "DPDP Act s.9; Rules 2025, Rule 10",
    fix: "Say whether you process data of children under 18, and if so how you get verifiable consent from a parent or guardian.",
  };
  const h = firstHit(pages, CHILDREN);
  if (h) return { ...base, status: "pass", finding: "Mentions children's data or parental consent.", evidence: evidenceOf(h), fix: undefined };
  if (!notice) return unknownCheck(base);
  return { ...base, status: "warn", finding: "We couldn't find anything about children's data. If you don't serve children, say so." };
}

/* ---------------- all checks ---------------- */

const STATUS_ORDER: Record<SiteCheckStatus, number> = { fail: 0, warn: 1, unknown: 2, pass: 3 };

export function runChecks(input: AuditInput): { checks: SiteCheck[]; notices: SiteNotice[] } {
  const pages = corpus(input);
  const notice = hasReadableNotice(input);
  const india = isIndiaTargeted(input);
  const spa = !!input.home && isJsRendered(input.home.html, input.home.text);
  const trackers = input.home ? trackersInHtml(input.home.html) : [];
  const notices: SiteNotice[] = [];
  if (spa) notices.push({ id: "spa", text: "Your site renders with JavaScript; this check reads the HTML. A full browser check is coming." });
  if (input.home && !notice) {
    notices.push({ id: "no-policy", text: "We couldn't read a privacy notice, so checks of its wording say “Couldn't check” rather than fail." });
  }

  const checks: SiteCheck[] = [
    checkPrivacyNotice(input, spa),
    checkGrievanceContact(input, pages, notice),
    checkGrievanceTimeline(pages, notice),
    checkRights(pages, notice),
    checkBoard(input, pages, notice, india),
    checkWithdrawal(pages, notice),
    checkCmp(input.home, trackers.map((t) => t.name), spa),
    checkTrackers(input.home, trackers, spa),
    checkCookies(input.home),
    checkLanguages(input, india),
    checkHttps(input.home),
    checkChildren(pages, notice),
  ];
  return { checks, notices };
}

export const sortChecks = (checks: SiteCheck[]) => [...checks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
