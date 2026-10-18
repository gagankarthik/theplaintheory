import { matchUrl } from "./tracker-db";
import type { CategoryId, Property, Tracker, TrackerKind, TrackerStatus } from "./types";

/**
 * Tracker inventory: scan findings, scan reports, and the triage rules that turn findings into
 * the site's tracker list. Pure and client-safe.
 */

export interface Finding {
  kind: TrackerKind;
  /** vendor product name, or the host / cookie name when unknown */
  name: string;
  /** the host it loads from; for cookies, the site that set it */
  host: string;
  party: "first" | "third";
  /** null when the tracker database doesn't know it: it waits in "To review" */
  category: CategoryId | null;
  vendor?: string;
  purpose?: string;
  /** cookie lifetime, e.g. "2 years" or "Session" */
  expiry?: string;
  /** pages it was found on (at most 10) */
  pages: string[];
  /** what a Tracker would hold: the DB's primary URL pattern, the host, or the cookie name */
  pattern: string;
  /** tracker database id, when known */
  dbId?: string;
  /** one example address or cookie, at most 200 characters */
  sample?: string;
  /** headless scans only: cookie flags read from the browser and raw Set-Cookie headers */
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  /** headless scans only: where a kind "cookie" finding was stored */
  storage?: "cookie" | "localStorage" | "sessionStorage";
}

export interface ScanPage {
  url: string;
  /** HTTP status; null when the request failed or was skipped */
  status: number | null;
  note?: string;
}

/**
 * queued/running: a headless crawl in progress (lib/crawler). ok/failed: finished.
 * cancelled: stopped by a user before it finished.
 */
export type ScanStatus = "queued" | "running" | "ok" | "failed" | "cancelled";

export interface ScanLogLine {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
  url?: string;
  /** stack trace or extra context, at most 2000 characters */
  detail?: string;
}

/** log lines kept per scan report */
export const SCAN_LOG_KEEP = 200;

export const isScanActive = (r: Pick<ScanReport, "status">) => r.status === "queued" || r.status === "running";

export interface ScanReport {
  id: string;
  propertyId: string;
  startedAt: string;
  /** empty string while the scan is queued or running */
  finishedAt: string;
  status: ScanStatus;
  /** "headless": real Chromium crawl (services/crawler). "fetch": server-HTML scan (lib/scan.ts). Absent = fetch. */
  engine?: "headless" | "fetch";
  /** live counters while a headless crawl runs */
  progress?: { pagesScanned: number; pagesQueued: number; findings: number };
  /** newest last, at most SCAN_LOG_KEEP lines */
  log?: ScanLogLine[];
  limits?: { maxPages: number; maxDepth: number };
  /** names of non-essential trackers set before any consent decision (a compliance problem) */
  preConsent?: string[];
  /** id of the crawler task that ran it */
  workerId?: string;
  error?: string;
  /** the homepage after redirects, when reached */
  homeUrl?: string;
  pages: ScanPage[];
  findings: Finding[];
  runBy?: string;
}

/** scan reports kept per site */
export const SCAN_KEEP = 20;

export const statusOf = (t: Pick<Tracker, "status">): TrackerStatus => t.status ?? "approved";

export type HeldTracker = Tracker & { category: CategoryId };

/** Approved trackers with a category: the site's live inventory. */
export const isHeld = (t: Tracker): t is HeldTracker => statusOf(t) === "approved" && t.category !== null;
export const heldTrackers = (list: Tracker[]): HeldTracker[] => list.filter(isHeld);

/**
 * What the SDK receives: approved, categorised, not essential (never held) and matchable against a
 * request address. Cookie-only entries are inventory for the cookie policy; their names would
 * misfire as substrings of script addresses.
 */
export function sdkTrackers(list: Tracker[]): { p: string; c: CategoryId }[] {
  return heldTrackers(list)
    .filter((t) => t.category !== "essential" && t.kind !== "cookie")
    .map((t) => ({ p: t.pattern, c: t.category }));
}

/**
 * Cookie and storage names the SDK clears while their category isn't allowed: cookies catalogued by
 * name, plus the known cookies of each approved vendor (GA's _ga and _ga_*, Meta's _fbp, ...), under
 * the category the site chose for that vendor. "*" is a wildcard. Essential ones are never cleared.
 */
export function sdkCookies(list: Tracker[]): { n: string; c: CategoryId }[] {
  const out = new Map<string, CategoryId>();
  for (const t of heldTrackers(list)) {
    if (t.category === "essential") continue;
    if (t.kind === "cookie") {
      out.set(t.pattern, t.category);
      continue;
    }
    for (const [name] of matchUrl(`https://${t.pattern}`)?.def.cookies ?? []) if (!out.has(name)) out.set(name, t.category);
  }
  return [...out].slice(0, 300).map(([n, c]) => ({ n, c }));
}

export const sameSdkTrackers = (a: Tracker[], b: Tracker[]) =>
  JSON.stringify(sdkTrackers(a)) === JSON.stringify(sdkTrackers(b)) && JSON.stringify(sdkCookies(a)) === JSON.stringify(sdkCookies(b));

/* ---------------- triage ---------------- */

export interface Candidate {
  kind: TrackerKind;
  name: string;
  pattern: string;
  category: CategoryId | null;
  vendor?: string;
  purpose?: string;
  expiry?: string;
  party: "first" | "third";
  pages: string[];
  /** addresses and cookie names seen, used to recognise trackers the site already lists */
  samples: string[];
}

const KIND_RANK: Record<TrackerKind, number> = { script: 0, iframe: 1, pixel: 2, cookie: 3 };

/**
 * One candidate per vendor product (database id), or per host / cookie name when unknown.
 * A known product found only through its cookies still holds by its script pattern when it has one.
 */
export function candidatesFrom(findings: Finding[]): Candidate[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.dbId ? `db:${f.dbId}` : `${f.kind === "cookie" ? "cookie" : "host"}:${f.pattern.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.values()].map((fs) => {
    const sorted = [...fs].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
    const lead = sorted[0];
    // A cookie finding's sample is the cookie name. When its pattern differs, the database gave the
    // product's script pattern, so the tracker holds that script rather than listing a cookie.
    const kind: TrackerKind = lead.kind === "cookie" && lead.sample !== undefined && lead.pattern !== lead.sample ? "script" : lead.kind;
    const pages = [...new Set(fs.flatMap((f) => f.pages))];
    return {
      kind,
      name: lead.name,
      pattern: lead.pattern,
      category: lead.category,
      vendor: lead.vendor,
      purpose: lead.purpose,
      expiry: fs.find((f) => f.expiry)?.expiry,
      party: fs.some((f) => f.party === "third") ? "third" : "first",
      pages,
      samples: [...new Set(fs.map((f) => f.sample ?? f.pattern))],
    };
  });
}

/** Does an existing tracker already cover this candidate? Same pattern, or its pattern is in an address seen. */
function covers(t: Tracker, c: Candidate): boolean {
  const tp = t.pattern.toLowerCase();
  if (tp === c.pattern.toLowerCase()) return true;
  if (t.kind === "cookie" || c.kind === "cookie") return c.samples.some((s) => s === t.pattern);
  return tp.length >= 4 && c.samples.some((s) => s.toLowerCase().includes(tp));
}

export interface MergeResult {
  trackers: Tracker[];
  /** new suggestions put in review */
  added: Tracker[];
  /** existing entries found again */
  seen: number;
}

/**
 * Fold a scan into the tracker list. Rules:
 *  - a new tracker from a vendor the database knows is approved straight away with that vendor's
 *    standard category (marked autoApproved, so the catalog says so and the site can change it):
 *    standard vendors never need a line-by-line sign-off before a banner can go live;
 *  - any other new tracker goes to "review", with the database's category when it knows one;
 *  - an approved one keeps its status, category and pattern: a scan never holds or releases anything;
 *  - an ignored one stays ignored, matched by pattern, so rescans don't suggest it again;
 *  - anything found again gets fresh "found on" pages, and blanks (vendor, purpose) filled in;
 *  - nothing is removed because a scan didn't see it (it may load after sign-in).
 */
export function mergeScan(existing: Tracker[], candidates: Candidate[], opts: { now: string; newId: () => string }): MergeResult {
  const trackers = existing.map((t) => ({ ...t }));
  const added: Tracker[] = [];
  let seen = 0;
  for (const c of candidates) {
    const hit = trackers.find((t) => covers(t, c));
    const found = { foundOn: c.pages.slice(0, 5), pageCount: c.pages.length, seenAt: opts.now };
    if (hit) {
      seen++;
      Object.assign(hit, found, {
        vendor: hit.vendor ?? c.vendor,
        purpose: hit.purpose ?? c.purpose,
        expiry: hit.expiry ?? c.expiry,
        party: hit.party ?? c.party,
      });
      if (statusOf(hit) === "review" && hit.category === null && c.category) hit.category = c.category;
      continue;
    }
    const known = Boolean(c.vendor && c.category);
    const t: Tracker = {
      id: opts.newId(),
      name: c.name.slice(0, 60),
      pattern: c.pattern.slice(0, 200),
      category: c.category,
      status: known ? "approved" : "review",
      ...(known ? { autoApproved: true } : {}),
      source: "scan",
      kind: c.kind,
      party: c.party,
      ...(c.vendor ? { vendor: c.vendor } : {}),
      ...(c.purpose ? { purpose: c.purpose } : {}),
      ...(c.expiry ? { expiry: c.expiry } : {}),
      ...found,
    };
    trackers.push(t);
    added.push(t);
  }
  return { trackers, added, seen };
}

/**
 * The property patch a tracker-list change produces: the draft version moves on only when the
 * approved inventory changes, so triaging suggestions doesn't mark the banner as unpublished.
 * Shared by writeTrackers (dashboard) and the crawler worker (no request context).
 */
const liveShape = (list: Tracker[]) => JSON.stringify(heldTrackers(list).map((t) => [t.name, t.pattern, t.category, t.kind ?? "script"]));
export function trackerPatch(property: Pick<Property, "trackers" | "config">, next: Tracker[]): Pick<Property, "trackers"> & Partial<Pick<Property, "config">> {
  const live = liveShape(next) !== liveShape(property.trackers);
  return { trackers: next, ...(live ? { config: { ...property.config, version: property.config.version + 1 } } : {}) };
}

/** Review items the database classified: what "Approve all suggested" approves. */
export const suggested = (list: Tracker[]) => list.filter((t) => statusOf(t) === "review" && t.category !== null && t.source === "scan" && !!t.vendor);
