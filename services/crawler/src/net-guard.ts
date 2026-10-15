import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivate } from "./app";

/**
 * SSRF guard for the browser. The crawler loads customer-supplied sites inside AWS, so every
 * request Chromium makes (pages, scripts, iframes, beacons, redirects) is checked before it leaves:
 * hosts that are, or resolve to, private, loopback, link-local or metadata addresses
 * (169.254.169.254, fd00:ec2::254) are aborted. The dashboard's fetch scanner applies the same rule
 * through lib/safe-fetch.ts (isPrivate is shared).
 *
 * Local development scans http://localhost:4000 (examples/demo-site), so CRAWLER_ALLOW_PRIVATE_NETWORK=true
 * turns the guard off. It is never set in AWS.
 */

const TTL_MS = 60_000;
const cache = new Map<string, { ok: boolean; at: number }>();

export function privateNetworkAllowed(): boolean {
  return process.env.CRAWLER_ALLOW_PRIVATE_NETWORK === "true";
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * isPrivate plus IPv4-mapped IPv6 forms of every private IPv4 range, in both spellings:
 * ::ffff:169.254.169.254 and the hex form URL parsing produces, ::ffff:a9fe:a9fe.
 */
function blocked(ip: string): boolean {
  const v = ip.toLowerCase();
  const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivate(dotted[1]);
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return isPrivate(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return isPrivate(ip);
}

/** True when the URL may be fetched. Non-HTTP(S) schemes (data:, blob:) never leave the browser and pass. */
export async function isAllowedUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  if (privateNetworkAllowed()) return true;

  const host = stripBrackets(url.hostname.toLowerCase());
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;

  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;

  let ok: boolean;
  if (isIP(host)) {
    ok = !blocked(host);
  } else {
    try {
      const addresses = await lookup(host, { all: true, verbatim: true });
      ok = addresses.length > 0 && addresses.every((a) => !blocked(a.address));
    } catch {
      // Unresolvable: Chromium would fail anyway; refusing keeps the decision on our side.
      ok = false;
    }
  }
  if (cache.size > 5000) cache.clear();
  cache.set(host, { ok, at: Date.now() });
  return ok;
}
