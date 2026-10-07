import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetching customer websites from our servers (tracker scan, live site check) without letting a
 * customer point us at our own network: every hop of a redirect chain must be http(s) on a
 * standard port and resolve only to public addresses.
 */

export const SCANNER_UA = "PlainTheoryScanner/1.0 (+https://theplaintheory.in/scanner)";

export function isPrivate(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export async function assertPublicHost(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https addresses can be scanned.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only standard web ports (80 and 443) can be scanned.");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local and internal addresses can't be scanned. Use your public domain.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) {
    throw new Error("That domain points to a private network address, so it can't be scanned.");
  }
}

export interface PublicFetchOptions {
  accept?: string;
  /** per-request timeout; ignored when `signal` is given */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** redirects followed before giving up (each hop is re-checked) */
  maxRedirects?: number;
  /** extra check on every hop, e.g. "same site only"; throw to refuse */
  allowHop?: (url: URL) => void;
}

export interface PublicFetchResult {
  /** the final, non-redirect response; null when the redirect limit ran out */
  res: Response | null;
  /** the last address requested */
  url: URL;
  /** Set-Cookie headers from every hop, in order */
  setCookies: string[];
}

/** GET with manual redirects so every hop is checked against the private-network rule. */
export async function fetchPublic(start: URL, opts: PublicFetchOptions = {}): Promise<PublicFetchResult> {
  const { accept = "text/html", timeoutMs = 8000, maxRedirects = 3, allowHop } = opts;
  let url = start;
  const setCookies: string[] = [];
  for (let hop = 0; hop <= maxRedirects; hop++) {
    allowHop?.(url);
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: opts.signal ?? AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": SCANNER_UA, accept },
    });
    setCookies.push(...(res.headers.getSetCookie?.() ?? []));
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      void res.body?.cancel().catch(() => undefined);
      continue;
    }
    return { res, url, setCookies };
  }
  return { res: null, url, setCookies };
}

/** Read a body as text, stopping once it passes `maxBytes`. */
export async function readCapped(res: Response, maxBytes = 3_000_000): Promise<{ text: string; truncated: boolean }> {
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size > maxBytes) {
      truncated = true;
      void reader.cancel().catch(() => undefined);
      break;
    }
  }
  return { text: new TextDecoder().decode(Buffer.concat(chunks)), truncated };
}
