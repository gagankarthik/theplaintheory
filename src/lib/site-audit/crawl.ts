import "server-only";
import { isIP } from "node:net";
import { fetchPublic, readCapped } from "../safe-fetch";
import type { AuditHome, AuditPage } from "./checks";
import { privacyLinks } from "./checks";
import { extractLinks, htmlToText, type PageLink } from "./html";
import { parseRobots, robotsAllows, type RobotsRules } from "./robots";
import type { PageKind, SiteNotice, SitePageVisit } from "./types";

/**
 * A small, polite crawler for the live site check: the homepage plus the policy pages it links to.
 * Same registrable domain only, at most MAX_PAGES pages, 8 s per request, 3 MB per page, 20 s in all,
 * text/html only, and robots.txt is honoured for our user agent. Every hop goes through fetchPublic,
 * which refuses private network addresses.
 */

export const LIMITS = { maxPages: 10, requestMs: 8000, maxBytes: 3_000_000, budgetMs: 20_000, robotsBytes: 500_000, concurrency: 3 };

/** Second-level labels under a two-letter country code that are public suffixes (co.in, co.uk, com.au…). */
const SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "ac", "edu", "res", "gen", "firm", "ind", "nic", "mil", "ltd", "plc", "sch", "nhs", "govt", "or", "ne", "go"]);

export function registrableDomain(host: string) {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (isIP(h)) return h;
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  const tld = parts[parts.length - 1];
  const sl = parts[parts.length - 2];
  return SECOND_LEVEL.has(sl) && tld.length === 2 ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}

export const sameSite = (a: string, site: string) => {
  const h = a.toLowerCase().replace(/\.$/, "");
  return h === site || h.endsWith(`.${site}`);
};

const KIND_RULES: { kind: Exclude<PageKind, "home" | "robots">; re: RegExp; score: number; max: number }[] = [
  { kind: "privacy", re: /privacy|datenschutz|confidentialit|privacidad|गोपनीयता/i, score: 100, max: 3 },
  { kind: "grievance", re: /grievance|complaint|redress|data[- _]?protection[- _]?officer|\bdpo\b|nodal[- ]officer/i, score: 90, max: 2 },
  { kind: "cookies", re: /cookie/i, score: 60, max: 1 },
  { kind: "contact", re: /contact/i, score: 50, max: 2 },
  { kind: "legal", re: /^\s*legal\b|\blegal (?:notice|information)|imprint|impressum|disclaimer/i, score: 40, max: 2 },
  { kind: "terms", re: /terms|conditions|\btos\b/i, score: 30, max: 1 },
];

const SKIP_EXT = /\.(?:pdf|docx?|xlsx?|zip|png|jpe?g|gif|svg|webp|mp4|mp3|css|js|json|xml|txt)$/i;

export interface Candidate {
  url: string;
  kind: Exclude<PageKind, "home" | "robots">;
  score: number;
  via: "link" | "guess";
  text: string;
}

/** Policy-looking links, best first, capped per kind. PDFs are reported, not read. */
export function pickCandidates(links: PageLink[], site: string, seen: Set<string>): { picked: Candidate[]; pdfs: string[] } {
  const byUrl = new Map<string, Candidate>();
  const pdfs: string[] = [];
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(u.protocol) || !sameSite(u.hostname, site)) continue;
    const label = `${l.text} ${decodeURIComponent(u.pathname).replace(/[-_/]/g, " ")}`;
    const rule = KIND_RULES.find((r) => r.re.test(label));
    if (!rule) continue;
    if (rule.kind === "privacy" && !privacyLinks([l]).length) continue;
    if (/\.pdf$/i.test(u.pathname)) {
      if (rule.kind === "privacy" || rule.kind === "grievance") pdfs.push(u.toString());
      continue;
    }
    if (SKIP_EXT.test(u.pathname)) continue;
    const key = u.toString();
    if (seen.has(key)) continue;
    const prev = byUrl.get(key);
    // "Privacy policy" or "Privacy notice" beats a page that only mentions privacy
    const score = rule.score + (/policy|notice|statement/i.test(label) ? 5 : 0);
    if (!prev || prev.score < score) byUrl.set(key, { url: key, kind: rule.kind, score, via: "link", text: l.text });
  }
  const count = new Map<string, number>();
  const picked = [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const n = count.get(c.kind) ?? 0;
      const max = KIND_RULES.find((r) => r.kind === c.kind)!.max;
      if (n >= max) return false;
      count.set(c.kind, n + 1);
      return true;
    });
  return { picked, pdfs };
}

export interface CrawlResult {
  home: AuditHome | null;
  pages: AuditPage[];
  visits: SitePageVisit[];
  notices: SiteNotice[];
}

const isHtml = (ct: string | null) => !ct || /text\/html|application\/xhtml\+xml/i.test(ct);

function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code ?? "";
  if (/abort|timeout/i.test(msg) || /TimeoutError|AbortError/.test((e as Error)?.name ?? "")) return "Took too long to respond.";
  if (/ENOTFOUND|EAI_AGAIN/.test(msg + code)) return "The domain doesn't resolve.";
  if (/ECONNREFUSED/.test(msg + code)) return "The server refused the connection.";
  if (/CERT|SSL|TLS/i.test(msg + code + (cause?.message ?? ""))) return "The HTTPS certificate couldn't be verified.";
  if (/scanned|another site/.test(msg)) return msg;
  return "The request failed.";
}

export async function crawlSite(domain: string): Promise<CrawlResult> {
  const started = Date.now();
  const budget = AbortSignal.timeout(LIMITS.budgetMs);
  const left = () => LIMITS.budgetMs - (Date.now() - started);
  const signal = () => AbortSignal.any([AbortSignal.timeout(Math.min(LIMITS.requestMs, Math.max(1, left()))), budget]);

  const visits: SitePageVisit[] = [];
  const notices: SiteNotice[] = [];
  const pages: AuditPage[] = [];
  const robotsByOrigin = new Map<string, RobotsRules | null>();

  let start: URL;
  try {
    start = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
  } catch {
    return { home: null, pages, visits, notices: [{ id: "unreachable", text: "Your site's domain isn't a valid web address." }] };
  }
  const site = registrableDomain(start.hostname);
  const allowHop = (u: URL) => {
    if (!sameSite(u.hostname, site)) throw new Error(`It redirects to another site (${u.hostname}), which we don't follow.`);
  };

  async function robotsFor(u: URL): Promise<RobotsRules | null> {
    if (robotsByOrigin.has(u.origin)) return robotsByOrigin.get(u.origin)!;
    let rules: RobotsRules | null = null;
    const url = new URL("/robots.txt", u.origin);
    try {
      const r = await fetchPublic(url, { accept: "text/plain", signal: signal(), allowHop });
      visits.push({ url: url.toString(), kind: "robots", status: r.res?.status ?? null });
      if (r.res?.ok && /text\/plain/i.test(r.res.headers.get("content-type") ?? "text/plain")) {
        rules = parseRobots((await readCapped(r.res, LIMITS.robotsBytes)).text);
      } else {
        void r.res?.body?.cancel().catch(() => undefined);
      }
    } catch {
      // no robots.txt, or it couldn't be read: crawl as allowed
    }
    robotsByOrigin.set(u.origin, rules);
    return rules;
  }

  async function allowed(u: URL) {
    const rules = await robotsFor(u);
    return !rules || robotsAllows(rules, `${u.pathname}${u.search}`);
  }

  /** Fetch one HTML page; records a visit either way. */
  async function getPage(u: URL, kind: PageKind): Promise<{ url: string; html: string; setCookies: string[]; hsts: string | null } | null> {
    if (left() < 500) {
      visits.push({ url: u.toString(), kind, status: null, note: "Skipped: out of time." });
      return null;
    }
    if (!(await allowed(u))) {
      visits.push({ url: u.toString(), kind, status: null, note: "Skipped: robots.txt asks us not to." });
      return null;
    }
    try {
      const r = await fetchPublic(u, { accept: "text/html,application/xhtml+xml", signal: signal(), allowHop });
      if (!r.res) {
        visits.push({ url: u.toString(), kind, status: null, note: "Too many redirects." });
        return null;
      }
      const res = r.res;
      const finalUrl = r.url.toString();
      if (!res.ok) {
        visits.push({ url: finalUrl, kind, status: res.status, note: `HTTP ${res.status}` });
        void res.body?.cancel().catch(() => undefined);
        return null;
      }
      if (!isHtml(res.headers.get("content-type"))) {
        visits.push({ url: finalUrl, kind, status: res.status, note: "Not an HTML page." });
        void res.body?.cancel().catch(() => undefined);
        return null;
      }
      const body = await readCapped(res, LIMITS.maxBytes);
      if (body.truncated && !notices.some((n) => n.id === "truncated")) notices.push({ id: "truncated", text: "A page was larger than 3 MB, so we read only its first 3 MB." });
      visits.push({ url: finalUrl, kind, status: res.status });
      return { url: finalUrl, html: body.text, setCookies: r.setCookies, hsts: res.headers.get("strict-transport-security") };
    } catch (e) {
      visits.push({ url: u.toString(), kind, status: null, note: describeError(e) });
      return null;
    }
  }

  // 1. Homepage, over HTTPS first and HTTP only if HTTPS can't connect at all.
  let homeRaw = await getPage(start, "home");
  const homeVisit = visits[visits.length - 1];
  if (!homeRaw && start.protocol === "https:" && homeVisit?.status === null && /certificate|refused|failed/i.test(homeVisit.note ?? "")) {
    const http = new URL(start.toString());
    http.protocol = "http:";
    homeRaw = await getPage(http, "home");
  }
  if (!homeRaw) {
    const last = visits.filter((v) => v.kind === "home").pop();
    const why = last?.note?.startsWith("Skipped: robots") ? "robots" : "unreachable";
    notices.push(
      why === "robots"
        ? { id: "robots", text: "Your robots.txt asks crawlers like ours (PlainTheoryScanner) not to read your homepage, so we stopped." }
        : { id: "unreachable", text: `We couldn't load your homepage. ${last?.note ?? ""}`.trim() },
    );
    return { home: null, pages, visits, notices };
  }
  const home: AuditHome = { url: homeRaw.url, kind: "home", html: homeRaw.html, text: htmlToText(homeRaw.html), setCookies: homeRaw.setCookies, hsts: homeRaw.hsts };

  // 2. Policy pages linked from the homepage; common paths when no privacy link is visible.
  const seen = new Set<string>([home.url, start.toString()]);
  const { picked, pdfs } = pickCandidates(extractLinks(home.html, home.url), site, seen);

  async function runQueue(list: Candidate[]) {
    const work = list.filter((c) => !seen.has(c.url));
    work.forEach((c) => seen.add(c.url));
    let i = 0;
    const worker = async () => {
      while (i < work.length && pages.length + 1 < LIMITS.maxPages && left() > 500) {
        const c = work[i++];
        const got = await getPage(new URL(c.url), c.kind);
        if (got && pages.length + 1 < LIMITS.maxPages) pages.push({ url: got.url, kind: c.kind, html: got.html, text: htmlToText(got.html), via: c.via, rank: c.score });
      }
    };
    await Promise.all(Array.from({ length: LIMITS.concurrency }, worker));
  }

  await runQueue(picked.slice(0, LIMITS.maxPages - 1));
  if (!pages.some((p) => p.kind === "privacy")) {
    // No privacy link we could read (often a footer built by JavaScript): try the usual addresses, stopping at the first that works.
    for (const path of ["/privacy-policy", "/privacy"]) {
      if (pages.some((p) => p.kind === "privacy")) break;
      await runQueue([{ url: new URL(path, home.url).toString(), kind: "privacy", score: 0, via: "guess", text: "" }]);
    }
  }
  // 3. One level deeper: grievance and contact pages linked from the privacy notice.
  if (pages.length + 1 < LIMITS.maxPages && left() > 1500) {
    const deeper = pages
      .filter((p) => p.kind === "privacy")
      .flatMap((p) => pickCandidates(extractLinks(p.html, p.url), site, seen).picked)
      .filter((c) => c.kind === "grievance" || c.kind === "contact" || c.kind === "privacy");
    await runQueue(deeper.slice(0, LIMITS.maxPages - 1 - pages.length));
  }

  if (pdfs.length && !pages.some((p) => p.kind === "privacy")) {
    notices.push({ id: "pdf", text: "Your privacy notice is a PDF. We read web pages only, so its wording wasn't checked." });
  }
  if (visits.some((v) => v.note?.startsWith("Skipped: robots"))) {
    notices.push({ id: "robots", text: "Your robots.txt asks crawlers like ours not to read some pages, so we skipped them." });
  }
  if (visits.some((v) => v.note === "Skipped: out of time.") || left() <= 0) {
    notices.push({ id: "budget", text: "Your site was slow to answer, so we stopped after 20 seconds and checked what we had." });
  }
  return { home, pages, visits, notices };
}
