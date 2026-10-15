import {
  classifyPages,
  cookieLifetime,
  matchCookie,
  matchUrl,
  primaryPattern,
  registrableDomain,
  sameSite,
  type Finding,
  type HtmlPageCapture,
  type TrackerDef,
} from "./app";
import type { CapturedCookie, CapturedRequestHost, CapturedStorageKey } from "./scanner/types";

/**
 * Turns what the headless crawl observed into the dashboard's Finding shape, so a headless report
 * is triaged exactly like a fetch scan (candidatesFrom → mergeScan).
 *
 * Three sources, merged by the same keys the fetch scanner uses (`<kind>:db:<id>`,
 * `<kind>:host:<host>`, `cookie:<name>`):
 *  1. The rendered DOM of every page, through the dashboard's own classifyPages (tag snippets,
 *     scripts, iframes, pixels, Set-Cookie headers) — includes tags the site holds until consent.
 *  2. Network requests the browser actually made (catches tags injected at runtime by tag managers).
 *  3. The browser's cookie jar (HttpOnly/Secure/SameSite flags and real expiry) and storage keys.
 * Sources 2 and 3 are what fired for a visitor who has not consented: any non-essential tracker
 * there is recorded in `preConsent`.
 */

const MAX_FINDINGS = 300;
const MAX_PAGES = 10;

export interface ClassifiedCrawl {
  findings: Finding[];
  /** Names of non-essential trackers that loaded or set storage before any consent decision. */
  preConsent: string[];
}

function keyOf(f: Finding): string {
  if (f.kind === "cookie") return `cookie:${f.sample ?? f.name}`;
  return f.dbId ? `${f.kind}:db:${f.dbId}` : `${f.kind}:host:${f.host}`;
}

function lifetimeFromExpiry(expires: number | null, nowSec: number): string {
  if (expires === null) return "Session";
  return cookieLifetime(`x=1; max-age=${Math.round(expires - nowSec)}`);
}

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/^\./, "").replace(/:\d+$/, "");

type RequestKind = "script" | "iframe" | "pixel";

/** Puppeteer/CDP resource type → tracker kind; null for types that never identify a tracker. */
function kindOf(resourceType: string): RequestKind | null {
  switch (resourceType) {
    case "script":
      return "script";
    case "document":
    case "subdocument":
      return "iframe";
    case "image":
    case "ping":
    case "beacon":
    case "xhr":
    case "fetch":
    case "eventsource":
    case "websocket":
    case "other":
      return "pixel";
    default:
      return null;
  }
}

const KIND_ORDER: Record<RequestKind, number> = { script: 0, iframe: 1, pixel: 2 };

export class FindingCollector {
  private readonly byKey = new Map<string, Finding>();
  private readonly preConsent = new Set<string>();
  private siteRoot: string;

  constructor(private siteHost: string) {
    this.siteRoot = registrableDomain(normalizeHost(siteHost));
  }

  /** The crawl may redirect (apex → www); party decisions follow the final site. */
  setSiteHost(host: string): void {
    this.siteHost = host;
    this.siteRoot = registrableDomain(normalizeHost(host));
  }

  private party(host: string): Finding["party"] {
    return sameSite(normalizeHost(host), this.siteRoot) ? "first" : "third";
  }

  private add(f: Finding): Finding {
    const key = keyOf(f);
    const existing = this.byKey.get(key);
    if (!existing) {
      if (this.byKey.size >= MAX_FINDINGS) return f;
      const fresh = { ...f, pages: f.pages.slice(0, MAX_PAGES) };
      this.byKey.set(key, fresh);
      return fresh;
    }
    for (const p of f.pages) if (existing.pages.length < MAX_PAGES && !existing.pages.includes(p)) existing.pages.push(p);
    // Browser observations carry facts the HTML can't: keep them.
    if (f.httpOnly !== undefined) existing.httpOnly = f.httpOnly;
    if (f.secure !== undefined) existing.secure = f.secure;
    if (f.sameSite !== undefined) existing.sameSite = f.sameSite;
    if (f.storage !== undefined) {
      // The jar knows which domain really owns a cookie; a header seen on a page may have come from
      // a third-party response without a Domain attribute.
      existing.storage = f.storage;
      existing.host = f.host;
      existing.party = f.party;
    }
    if (f.expiry && (!existing.expiry || existing.expiry === "Session")) existing.expiry = f.expiry;
    existing.vendor ??= f.vendor;
    existing.purpose ??= f.purpose;
    return existing;
  }

  private known(def: TrackerDef, matched: string): Pick<Finding, "name" | "category" | "vendor" | "purpose" | "pattern" | "dbId"> {
    return { name: def.name, category: def.category, vendor: def.vendor, purpose: def.purpose, pattern: primaryPattern(def) ?? matched, dbId: def.id };
  }

  private flagPreConsent(f: Pick<Finding, "category" | "name">): void {
    if (f.category && f.category !== "essential") this.preConsent.add(f.name);
  }

  /** Source 1: one rendered page, through the dashboard's HTML classifier. */
  addHtmlPage(page: HtmlPageCapture): void {
    for (const f of classifyPages([page], normalizeHost(this.siteHost))) this.add(f);
  }

  /** Source 2: hosts the browser requested. */
  addRequestHosts(hosts: CapturedRequestHost[]): void {
    for (const h of hosts) {
      const party = this.party(h.host);
      let matchedAny = false;
      for (const sample of h.samples) {
        const kind = kindOf(sample.resourceType);
        if (!kind) continue;
        let url: URL;
        try {
          url = new URL(sample.url);
        } catch {
          continue;
        }
        const m = matchUrl(url);
        if (!m) continue;
        matchedAny = true;
        const f = this.add({
          kind,
          host: h.host,
          party,
          pages: h.pages,
          sample: `${url.hostname}${url.pathname}`.slice(0, 200),
          ...this.known(m.def, m.matched),
        });
        this.flagPreConsent(f);
      }
      if (matchedAny || party === "first") continue;
      // Unknown third party: kept only when it ran code or framed content, like the fetch scanner.
      const kinds = [...new Set(h.samples.map((s) => kindOf(s.resourceType)).filter((k): k is RequestKind => k === "script" || k === "iframe"))];
      if (!kinds.length) continue;
      const kind = kinds.sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b])[0]!;
      this.add({ kind, name: h.host, host: h.host, party, category: null, pattern: h.host, pages: h.pages, sample: h.sampleUrl.replace(/^https?:\/\//, "").slice(0, 200) });
    }
  }

  /** Source 3a: the browser's cookie jar (includes HttpOnly cookies scripts can't see). */
  addCookies(cookies: CapturedCookie[], now = Date.now()): void {
    const nowSec = Math.floor(now / 1000);
    for (const c of cookies) {
      const host = normalizeHost(c.domain);
      const party = this.party(host);
      const lifetime = lifetimeFromExpiry(c.expires, nowSec);
      const flags = { httpOnly: c.httpOnly, secure: c.secure, ...(c.sameSite ? { sameSite: c.sameSite } : {}), storage: "cookie" as const };
      const m = matchCookie(c.name);
      const f = m
        ? this.add({
            kind: "cookie",
            host,
            party,
            pages: c.seenOnUrls,
            sample: c.name,
            expiry: lifetime === "Session" ? m.expiry : lifetime,
            ...this.known(m.def, c.name),
            ...flags,
          })
        : this.add({ kind: "cookie", name: c.name, host, party, category: null, pattern: c.name, expiry: lifetime, pages: c.seenOnUrls, sample: c.name, ...flags });
      this.flagPreConsent(f);
    }
  }

  /** Source 3b: localStorage / sessionStorage keys the tracker database recognises. */
  addStorage(keys: CapturedStorageKey[]): void {
    for (const s of keys) {
      const m = matchCookie(s.key);
      if (!m) continue;
      const storage = s.storageType === "LOCAL_STORAGE" ? ("localStorage" as const) : ("sessionStorage" as const);
      const f = this.add({
        kind: "cookie",
        host: normalizeHost(s.host),
        party: this.party(s.host),
        pages: s.seenOnUrls,
        sample: s.key,
        expiry: storage === "localStorage" ? "Persistent" : "Session",
        storage,
        ...this.known(m.def, s.key),
      });
      this.flagPreConsent(f);
    }
  }

  get size(): number {
    return this.byKey.size;
  }

  result(): ClassifiedCrawl {
    return { findings: [...this.byKey.values()], preConsent: [...this.preConsent].sort() };
  }
}
