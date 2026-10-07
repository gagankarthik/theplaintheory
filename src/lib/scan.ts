import "server-only";
import { id } from "./crypto";
import { fetchPublic, readCapped } from "./safe-fetch";
import { registrableDomain, sameSite } from "./site-audit/crawl";
import { attr, extractLinks, extractScripts } from "./site-audit/html";
import { parseRobots, robotsAllows, type RobotsRules } from "./site-audit/robots";
import { matchCookie, matchInline, matchUrl, primaryPattern, type TrackerDef } from "./tracker-db";
import type { Finding, ScanPage, ScanReport } from "./trackers";

/**
 * Tracker scanner. Reads up to SCAN_LIMITS.maxPages same-site pages (the homepage, then the pages
 * it links to, spread across sections) and classifies every script, iframe, tracking pixel and
 * Set-Cookie header against the tracker database. Every request goes through fetchPublic, so
 * private network addresses are refused at each redirect hop; robots.txt is honoured.
 *
 * It reads server HTML only. Trackers that a tag manager or app code adds after the page starts
 * are found when the tag manager itself is (Phase 2 adds a headless browser and SDK traffic).
 */

export const SCAN_LIMITS = { maxPages: 10, requestMs: 8000, maxBytes: 3_000_000, budgetMs: 25_000, robotsBytes: 500_000, concurrency: 3, maxFindings: 200 };

export interface PageCapture {
  url: string;
  html: string;
  setCookies: string[];
}

/* ---------------- classification (pure) ---------------- */

const ASSET = /\.(?:pdf|docx?|xlsx?|zip|png|jpe?g|gif|svg|webp|avif|ico|mp4|mp3|webm|css|js|mjs|json|xml|txt|rss|atom|woff2?)$/i;
const SKIP_PATH = /\/(?:wp-admin|wp-login|logout|log-out|signout|sign-out|cart\/add|checkout|cdn-cgi|feed)\b/i;
const FRAMEWORK_DATA = /^\s*\(?\s*(?:self|window)\.(?:__next_f|__NUXT__|__remixContext|__APOLLO_STATE__|__INITIAL_STATE__|__PRELOADED_STATE__|__staticRouterHydrationData)\b/;
/** URLs written in inline code: https://host/..., //host/... */
const INLINE_URL = /(?:https?:)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'`\\)<>]*)?/gi;

function absolute(raw: string | undefined, base: string): URL | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || /^(?:data|blob|javascript|about):/i.test(v)) return null;
  try {
    const u = new URL(v, base);
    return /^https?:$/.test(u.protocol) ? u : null;
  } catch {
    return null;
  }
}

/** "2 years", "30 days", "Session": a Set-Cookie header's lifetime, read from Max-Age or Expires. */
export function cookieLifetime(header: string, now = Date.now()): string {
  const maxAge = header.match(/;\s*max-age\s*=\s*(-?\d+)/i);
  let seconds: number | null = maxAge ? Number(maxAge[1]) : null;
  if (seconds === null) {
    const exp = header.match(/;\s*expires\s*=\s*([^;]+)/i);
    const at = exp ? Date.parse(exp[1].trim()) : NaN;
    if (Number.isFinite(at)) seconds = Math.round((at - now) / 1000);
  }
  if (seconds === null) return "Session";
  if (seconds <= 0) return "Deleted";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (seconds < 3600) return plural(Math.max(1, Math.round(seconds / 60)), "minute");
  if (seconds < 86400) return plural(Math.round(seconds / 3600), "hour");
  if (seconds < 60 * 86400) return plural(Math.round(seconds / 86400), "day");
  const months = Math.round(seconds / (30.44 * 86400));
  if (months === 12) return "1 year";
  if (months < 24) return plural(months, "month");
  return plural(Math.round(seconds / (365.25 * 86400)), "year");
}

const isPixel = (tag: string) => {
  const w = attr(tag, "width");
  const h = attr(tag, "height");
  const tiny = (v?: string) => v !== undefined && /^\s*[01](?:px)?\s*$/.test(v);
  return (tiny(w) && tiny(h)) || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(tag, "style") ?? "");
};

/**
 * Classify what the pages load. Known items (the tracker database) are kept wherever they load from;
 * unknown third-party scripts, iframes and pixels become findings with no category (to review);
 * unknown first-party scripts and images are the site's own and are left out; every cookie the
 * server sets is listed.
 */
export function classifyPages(pages: PageCapture[], siteHost: string): Finding[] {
  const site = registrableDomain(siteHost);
  const byKey = new Map<string, Finding>();
  const party = (host: string): Finding["party"] => (sameSite(host, site) ? "first" : "third");

  const add = (key: string, page: string, make: () => Omit<Finding, "pages">) => {
    const f = byKey.get(key);
    if (f) {
      if (!f.pages.includes(page) && f.pages.length < 10) f.pages.push(page);
      return;
    }
    if (byKey.size >= SCAN_LIMITS.maxFindings) return;
    byKey.set(key, { ...make(), pages: [page] });
  };

  const known = (def: TrackerDef, matched: string, extra: Partial<Finding> = {}): Omit<Finding, "pages" | "kind" | "host" | "party"> => ({
    name: def.name,
    category: def.category,
    vendor: def.vendor,
    purpose: def.purpose,
    pattern: primaryPattern(def) ?? matched,
    dbId: def.id,
    ...extra,
  });

  const onUrl = (kind: "script" | "iframe" | "pixel", u: URL, page: string, opts: { requireKnown?: boolean; pixelHint?: boolean } = {}) => {
    const host = u.hostname.toLowerCase();
    const p = party(host);
    const sample = `${host}${u.pathname}`.slice(0, 200);
    const m = matchUrl(u);
    if (m) {
      add(`${kind}:db:${m.def.id}`, page, () => ({ kind, host, party: p, ...known(m.def, m.matched, { sample }) }));
      return;
    }
    if (p === "first" || opts.requireKnown) return;
    if (kind === "pixel" && !opts.pixelHint) return;
    add(`${kind}:host:${host}`, page, () => ({ kind, name: host, host, party: p, category: null, pattern: host, sample }));
  };

  for (const page of pages) {
    const html = page.html.replace(/<!--[\s\S]*?-->/g, " ");

    for (const s of extractScripts(html)) {
      if (s.src) {
        const u = absolute(s.src, page.url);
        if (u) onUrl("script", u, page.url);
        continue;
      }
      if (s.type && /json|template|html|x-shader|text\/x-/.test(s.type)) continue;
      const code = s.inline;
      // framework hydration data (React Server Components, Nuxt, Remix…) quotes page text, such as
      // documentation that shows a tracking snippet; it never loads anything itself
      if (FRAMEWORK_DATA.test(code)) continue;
      for (const def of matchInline(code)) {
        const pat = primaryPattern(def) ?? def.id;
        add(`script:db:${def.id}`, page.url, () => ({ kind: "script", host: pat.split("/")[0] || "inline", party: "third", ...known(def, pat, { sample: "inline script" }) }));
      }
      // tag snippets write their loader address into the code: classify known ones only
      for (const m of code.matchAll(INLINE_URL)) {
        const u = absolute(m[0], page.url);
        if (u) onUrl("script", u, page.url, { requireKnown: true });
      }
    }

    for (const m of html.matchAll(/<iframe\b[^>]*>/gi)) {
      const u = absolute(attr(` ${m[0].slice(7)}`, "src") ?? attr(` ${m[0].slice(7)}`, "data-src"), page.url);
      if (u) onUrl("iframe", u, page.url);
    }

    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = ` ${m[0].slice(4)}`;
      const u = absolute(attr(tag, "src"), page.url);
      if (u) onUrl("pixel", u, page.url, { pixelHint: isPixel(tag) });
    }

    for (const header of page.setCookies) {
      const name = header.split(";")[0].split("=")[0].trim();
      if (!name) continue;
      const domainAttr = header.match(/;\s*domain\s*=\s*\.?([^;\s]+)/i)?.[1]?.toLowerCase();
      const host = domainAttr ?? new URL(page.url).hostname.toLowerCase();
      const p = party(host);
      const lifetime = cookieLifetime(header);
      const m = matchCookie(name);
      if (m) {
        add(`cookie:${name}`, page.url, () => ({
          kind: "cookie",
          host,
          party: p,
          ...known(m.def, name, { expiry: lifetime === "Session" || lifetime === "Deleted" ? m.expiry : lifetime, sample: name }),
        }));
      } else {
        add(`cookie:${name}`, page.url, () => ({ kind: "cookie", name, host, party: p, category: null, pattern: name, expiry: lifetime, sample: name }));
      }
    }
  }
  return [...byKey.values()];
}

/* ---------------- crawling ---------------- */

/** Same-site pages linked from `html`, spread across sections: one per first path segment first, shallow first. */
export function pickPages(html: string, base: string, site: string, seen: Set<string>): string[] {
  const urls = new Map<string, URL>();
  for (const l of extractLinks(html, base)) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !sameSite(u.hostname, site)) continue;
    if (ASSET.test(u.pathname) || SKIP_PATH.test(u.pathname)) continue;
    u.hash = "";
    u.search = "";
    const key = u.toString();
    if (!seen.has(key) && !urls.has(key)) urls.set(key, u);
  }
  const depth = (u: URL) => u.pathname.split("/").filter(Boolean).length;
  const list = [...urls.values()].sort((a, b) => depth(a) - depth(b) || a.pathname.length - b.pathname.length);
  const sections = new Set<string>();
  const first: string[] = [];
  const rest: string[] = [];
  for (const u of list) {
    const sec = `${u.hostname}/${u.pathname.split("/").filter(Boolean)[0] ?? ""}`;
    if (sections.has(sec)) rest.push(u.toString());
    else {
      sections.add(sec);
      first.push(u.toString());
    }
  }
  return [...first, ...rest];
}

export interface TrackerCrawl {
  homeUrl?: string;
  pages: PageCapture[];
  visits: ScanPage[];
  /** why nothing could be read */
  error?: string;
}

function describe(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { cause?: { code?: string } })?.cause?.code ?? "";
  if (/abort|timeout/i.test(msg) || /TimeoutError|AbortError/.test((e as Error)?.name ?? "")) return "Took too long to respond.";
  if (/ENOTFOUND|EAI_AGAIN/.test(msg + code)) return "The domain doesn't resolve. Check the spelling.";
  if (/ECONNREFUSED/.test(msg + code)) return "The server refused the connection.";
  if (/CERT|SSL|TLS/i.test(msg + code)) return "The HTTPS certificate couldn't be verified.";
  if (/scanned|another site|private network/.test(msg)) return msg;
  return "The request failed.";
}

export async function crawlForTrackers(domain: string): Promise<TrackerCrawl> {
  const started = Date.now();
  const left = () => SCAN_LIMITS.budgetMs - (Date.now() - started);
  const budget = AbortSignal.timeout(SCAN_LIMITS.budgetMs);
  const signal = () => AbortSignal.any([AbortSignal.timeout(Math.min(SCAN_LIMITS.requestMs, Math.max(1, left()))), budget]);
  const visits: ScanPage[] = [];
  const pages: PageCapture[] = [];

  let start: URL;
  try {
    start = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
  } catch {
    return { pages, visits, error: "That domain isn't a valid web address." };
  }
  const site = registrableDomain(start.hostname);
  const allowHop = (u: URL) => {
    if (!sameSite(u.hostname, site)) throw new Error(`It redirects to another site (${u.hostname}), which we don't follow.`);
  };

  const robots = new Map<string, RobotsRules | null>();
  async function allowed(u: URL) {
    if (!robots.has(u.origin)) {
      let rules: RobotsRules | null = null;
      try {
        const r = await fetchPublic(new URL("/robots.txt", u.origin), { accept: "text/plain", signal: signal(), allowHop });
        if (r.res?.ok && /text\/plain/i.test(r.res.headers.get("content-type") ?? "text/plain")) rules = parseRobots((await readCapped(r.res, SCAN_LIMITS.robotsBytes)).text);
        else void r.res?.body?.cancel().catch(() => undefined);
      } catch {
        // unreadable robots.txt: allowed
      }
      robots.set(u.origin, rules);
    }
    const rules = robots.get(u.origin);
    return !rules || robotsAllows(rules, `${u.pathname}${u.search}`);
  }

  async function get(u: URL): Promise<PageCapture | null> {
    if (left() < 500) {
      visits.push({ url: u.toString(), status: null, note: "Skipped: out of time." });
      return null;
    }
    if (!(await allowed(u))) {
      visits.push({ url: u.toString(), status: null, note: "Skipped: robots.txt asks us not to." });
      return null;
    }
    try {
      const r = await fetchPublic(u, { accept: "text/html,application/xhtml+xml", signal: signal(), allowHop });
      if (!r.res) {
        visits.push({ url: u.toString(), status: null, note: "Too many redirects." });
        return null;
      }
      const res = r.res;
      const url = r.url.toString();
      const ct = res.headers.get("content-type");
      if (!res.ok || (ct && !/text\/html|application\/xhtml\+xml/i.test(ct))) {
        visits.push({ url, status: res.status, note: res.ok ? "Not an HTML page." : `HTTP ${res.status}` });
        void res.body?.cancel().catch(() => undefined);
        return null;
      }
      const body = await readCapped(res, SCAN_LIMITS.maxBytes);
      visits.push({ url, status: res.status, ...(body.truncated ? { note: "Read the first 3 MB." } : {}) });
      return { url, html: body.text, setCookies: r.setCookies };
    } catch (e) {
      visits.push({ url: u.toString(), status: null, note: describe(e) });
      return null;
    }
  }

  const home = await get(start);
  if (!home) {
    const last = visits[visits.length - 1];
    const why = last?.note?.startsWith("Skipped: robots")
      ? "Your robots.txt asks crawlers like ours (PlainTheoryScanner) not to read your homepage."
      : last?.status
        ? `Your homepage answered with HTTP ${last.status}. Check the site is live and public.`
        : `We couldn't load your homepage. ${last?.note ?? ""}`.trim();
    return { pages, visits, error: why };
  }
  pages.push(home);
  const seen = new Set<string>([home.url, start.toString()]);

  async function crawl(queue: string[]) {
    const work = queue.filter((u) => !seen.has(u));
    work.forEach((u) => seen.add(u));
    let i = 0;
    const worker = async () => {
      while (i < work.length && pages.length < SCAN_LIMITS.maxPages && left() > 500) {
        const got = await get(new URL(work[i++]));
        if (got && pages.length < SCAN_LIMITS.maxPages && !pages.some((p) => p.url === got.url)) pages.push(got);
      }
    };
    await Promise.all(Array.from({ length: SCAN_LIMITS.concurrency }, worker));
  }

  await crawl(pickPages(home.html, home.url, site, seen).slice(0, SCAN_LIMITS.maxPages - 1));
  // a second level when the homepage links to few pages
  if (pages.length < SCAN_LIMITS.maxPages && left() > 2000) {
    const more = pages.slice(1).flatMap((p) => pickPages(p.html, p.url, site, seen));
    await crawl([...new Set(more)].slice(0, SCAN_LIMITS.maxPages - pages.length));
  }
  return { homeUrl: home.url, pages, visits };
}

/** Crawl and classify. Never throws for site problems: a failed scan is a report with status "failed". */
export async function runTrackerScan(input: { propertyId: string; domain: string; runBy?: string }): Promise<ScanReport> {
  const startedAt = new Date().toISOString();
  const base = { id: id("scan", 8), propertyId: input.propertyId, startedAt, ...(input.runBy ? { runBy: input.runBy } : {}) };
  try {
    const crawl = await crawlForTrackers(input.domain);
    if (crawl.error || !crawl.homeUrl) {
      return { ...base, finishedAt: new Date().toISOString(), status: "failed", error: crawl.error ?? "We couldn't load your homepage.", pages: crawl.visits, findings: [] };
    }
    const findings = classifyPages(crawl.pages, new URL(crawl.homeUrl).hostname);
    return { ...base, finishedAt: new Date().toISOString(), status: "ok", homeUrl: crawl.homeUrl, pages: crawl.visits, findings };
  } catch (e) {
    return { ...base, finishedAt: new Date().toISOString(), status: "failed", error: describe(e), pages: [], findings: [] };
  }
}
