import { lookup as lookupCallback, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { isPrivate } from "./app";

/**
 * SSRF guard for the browser. The crawler loads customer-supplied sites inside AWS, so every
 * request Chromium makes (pages, scripts, iframes, beacons, redirects) is checked before it leaves:
 * hosts that are, or resolve to, private, loopback, link-local or metadata addresses
 * (169.254.169.254, fd00:ec2::254) are aborted. The dashboard's fetch scanner applies the same rule
 * through lib/safe-fetch.ts (isPrivate is shared).
 *
 * Residual risk (no egress proxy by design): the browser guard resolves a host, then Chromium resolves it
 * again, so a hostile DNS server with a near-zero TTL can answer "public" to us and "private" to Chromium
 * (DNS rebinding). WebSockets and service workers bypass request interception; page-capture.ts disables
 * service worker registration and makes WebSockets to literal private addresses throw, but a WebSocket to
 * a name that resolves privately, or one opened from a web worker, is not caught. What limits the blast radius is the network: the task runs
 * alone in a public-subnet VPC with no peering, and the ECS credentials endpoint (169.254.170.2) needs a
 * per-task path the page cannot know. Node-side fetches (robots.txt) pin the check to the connection with
 * guardedLookup, so they are not exposed to rebinding.
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

/**
 * dns.lookup for http(s).request that refuses private addresses at connect time, so the address checked
 * is the address used (no rebinding window). Off when CRAWLER_ALLOW_PRIVATE_NETWORK=true.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  lookupCallback(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 4);
    const refused = !privateNetworkAllowed() && (!addresses.length || addresses.some((a) => blocked(a.address)));
    if (refused) {
      const e = Object.assign(new Error(`${hostname} resolves to a private or internal address`), { code: "EPRIVATE" });
      return callback(e, "", 4);
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};
