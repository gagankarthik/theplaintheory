import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { gunzipSync } from "node:zlib";
import { guardedLookup } from "../net-guard";

/**
 * Sitemap discovery, the way search engines start a crawl: the Sitemap: lines in robots.txt, else
 * /sitemap.xml and /sitemap_index.xml. Sitemap indexes are followed (nested at most twice), gzipped
 * sitemaps are unpacked, and every fetch goes through the same network guard as the browser
 * (redirects are followed by hand so each hop is checked). Hard caps keep a huge site cheap: we need
 * a representative sample of pages, not the whole index.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_SITEMAP_FILES = 12;
const MAX_INDEX_DEPTH = 2;

export interface SitemapOptions {
  userAgent: string;
  guard?: (url: string) => Promise<boolean>;
  /** stop after this many page URLs */
  limit?: number;
  timeoutMs?: number;
  log?: (message: string, url?: string) => void;
}

interface Fetched {
  status: number;
  location: string | null;
  body: Buffer;
}

function getOnce(url: URL, userAgent: string, guarded: boolean, signal: AbortSignal): Promise<Fetched> {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: "GET", headers: { "user-agent": userAgent, accept: "application/xml,text/xml,*/*;q=0.5" }, signal, ...(guarded ? { lookup: guardedLookup } : {}) },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (status < 200 || status >= 300) {
          res.resume();
          resolve({ status, location, body: Buffer.alloc(0) });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          if (size >= MAX_BYTES) return;
          chunks.push(chunk);
          size += chunk.length;
          if (size >= MAX_BYTES) res.destroy();
        });
        const done = () => resolve({ status, location, body: Buffer.concat(chunks) });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** GET with guarded, hand-followed redirects; null when it can't be fetched or isn't allowed. */
async function fetchXml(raw: string, opts: SitemapOptions, signal: AbortSignal): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (opts.guard && !(await opts.guard(url.toString()))) return null;
    const res = await getOnce(url, opts.userAgent, Boolean(opts.guard), signal);
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = new URL(res.location, url);
      continue;
    }
    if (res.status < 200 || res.status >= 300 || !res.body.length) return null;
    // gzipped sitemaps (sitemap.xml.gz), detected by their magic bytes rather than the name
    const body = res.body[0] === 0x1f && res.body[1] === 0x8b ? gunzipSync(res.body, { maxOutputLength: MAX_BYTES * 5 }) : res.body;
    return body.toString("utf8");
  }
  return null;
}

/** The <loc> values of a sitemap or sitemap index, entity-decoded. */
export function parseSitemap(xml: string): { kind: "index" | "urlset" | "unknown"; locs: string[] } {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? "index" : /<urlset[\s>]/i.test(xml) ? "urlset" : "unknown";
  const locs: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)) {
    locs.push(m[1].replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  }
  return { kind, locs };
}

/** www.example.com and example.com are the same site for discovery. */
const siteOf = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * Page URLs from the site's sitemaps, same site only, in sitemap order, at most `limit`.
 * `declared` are the Sitemap: lines from robots.txt; without them the usual locations are tried.
 */
export async function discoverSitemapUrls(startUrl: string, declared: string[], opts: SitemapOptions): Promise<string[]> {
  const limit = opts.limit ?? 2000;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000);
  const site = siteOf(new URL(startUrl).hostname);
  const candidates = declared.length ? declared : [new URL("/sitemap.xml", startUrl).toString(), new URL("/sitemap_index.xml", startUrl).toString()];
  const queue = candidates.map((url) => ({ url, depth: 0 }));
  const seenFiles = new Set<string>();
  const pages: string[] = [];
  const seenPages = new Set<string>();
  let files = 0;
  try {
    while (queue.length && files < MAX_SITEMAP_FILES && pages.length < limit) {
      const { url, depth } = queue.shift()!;
      if (seenFiles.has(url)) continue;
      seenFiles.add(url);
      const xml = await fetchXml(url, opts, signal).catch(() => null);
      files += 1;
      if (!xml) continue;
      const { kind, locs } = parseSitemap(xml);
      if (kind === "index") {
        if (depth < MAX_INDEX_DEPTH) for (const loc of locs) queue.push({ url: loc, depth: depth + 1 });
        opts.log?.(`Sitemap index with ${locs.length} sitemap(s)`, url);
        continue;
      }
      let added = 0;
      for (const loc of locs) {
        let u: URL;
        try {
          u = new URL(loc);
        } catch {
          continue;
        }
        if ((u.protocol !== "http:" && u.protocol !== "https:") || siteOf(u.hostname) !== site) continue;
        const key = u.toString();
        if (seenPages.has(key)) continue;
        seenPages.add(key);
        pages.push(key);
        added += 1;
        if (pages.length >= limit) break;
      }
      opts.log?.(`Sitemap with ${added} page(s)`, url);
    }
  } catch {
    /* timed out or aborted: use what was found */
  }
  return pages;
}
