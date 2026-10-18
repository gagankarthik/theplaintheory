import { registrableDomain } from "../app";

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/^\./, "").replace(/:\d+$/, "");

const TRACKING_PARAMS = new Set([
  "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid", "twclid", "li_fat_id", "yclid",
  "igshid", "mc_cid", "mc_eid", "_ga", "_gl", "_hsenc", "_hsmi", "__hstc", "__hssc", "__hsfp", "mkt_tok", "ref", "ref_src",
  "srsltid", "si", "spm",
]);

const BINARY_EXTENSIONS = new Set([
  "pdf", "zip", "gz", "tgz", "rar", "7z", "tar", "dmg", "exe", "msi", "apk", "iso", "bin",
  "jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "ico", "bmp", "tif", "tiff", "heic",
  "mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "ogg", "flac", "m4a",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "xml", "json", "rss", "atom",
  "css", "js", "mjs", "map", "woff", "woff2", "ttf", "otf", "eot",
]);

function isLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "localhost" || h.endsWith(".localhost") || /^127\.\d+\.\d+\.\d+$/.test(h) || h === "[::1]" || h === "0.0.0.0";
}

/**
 * Turns a stored Domain.hostname ("shop.example", "localhost:4000", or a full URL) into the crawl start URL.
 * Local hosts and hosts with an explicit port use http; everything else https.
 */
export function buildStartUrl(hostname: string): string {
  const trimmed = hostname.trim();
  if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed).toString();
  const hostPart = trimmed.split("/")[0] ?? trimmed;
  const hasPort = /:\d+$/.test(hostPart);
  const scheme = isLocalHost(hostPart.replace(/:\d+$/, "")) || hasPort ? "http" : "https";
  return new URL(`${scheme}://${trimmed}`).toString();
}

/** Canonical form used for de-duplication in the crawl frontier. Returns null for non-crawlable URLs. */
export function normalizeUrl(raw: string, base?: string): string | null {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  const kept: Array<[string, string]> = [];
  for (const [k, v] of url.searchParams) {
    const key = k.toLowerCase();
    if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) continue;
    kept.push([k, v]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  if (url.pathname === "") url.pathname = "/";
  return url.toString();
}

export function hasBinaryExtension(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    const last = pathname.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    if (dot === -1) return false;
    return BINARY_EXTENSIONS.has(last.slice(dot + 1).toLowerCase());
  } catch {
    return true;
  }
}

/**
 * Internal link test. Local hosts must match host:port exactly (other ports are different apps);
 * public hosts match on registrable domain so www/shop/blog subdomains are crawled together.
 */
export function isInternalUrl(candidate: string, start: string): boolean {
  let c: URL;
  let s: URL;
  try {
    c = new URL(candidate);
    s = new URL(start);
  } catch {
    return false;
  }
  if (isLocalHost(s.hostname) || isLocalHost(c.hostname)) return c.host === s.host;
  return registrableDomain(c.hostname) === registrableDomain(s.hostname);
}

/** Filters raw hrefs from a page down to normalised internal crawl candidates. */
export function extractCrawlableLinks(hrefs: string[], pageUrl: string, startUrl: string): string[] {
  const out = new Set<string>();
  for (const href of hrefs) {
    const trimmed = href.trim();
    if (!trimmed || /^(mailto|tel|javascript|data|sms|ftp|blob|about):/i.test(trimmed)) continue;
    const normalized = normalizeUrl(trimmed, pageUrl);
    if (!normalized) continue;
    if (!isInternalUrl(normalized, startUrl)) continue;
    if (hasBinaryExtension(normalized)) continue;
    out.add(normalized);
  }
  return [...out];
}

/** A path segment that names one item rather than a section: a number, an id, a hash, a date part. */
const ID_LIKE = /^(\d+|[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f-]{27,}|.*\d.*-.*|.*-.*\d.*)$/i;

/**
 * The page template a URL belongs to, the way a search engine clusters pages to spend its crawl
 * budget across the kinds of page a site has: /product/house-blend and /product/cold-brew are both
 * "/product/*", /blog/2026/why-tuesdays is "/blog/:id/*". The last segment of a path two or more deep
 * is treated as the item, ids anywhere are generalised, and the query string is ignored.
 */
export function templateKey(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  const key = segs.map((s, i) => (ID_LIKE.test(s) ? ":id" : i === segs.length - 1 && segs.length >= 2 ? "*" : s.toLowerCase()));
  return `${u.hostname.replace(/^www\./, "")}/${key.join("/")}`;
}
