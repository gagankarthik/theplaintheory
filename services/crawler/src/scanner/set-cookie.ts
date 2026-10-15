/**
 * RFC 6265 Set-Cookie parser for raw header values captured over CDP.
 * Chrome joins multiple Set-Cookie headers with "\n" in DevTools protocol header maps.
 */

export interface ParsedSetCookie {
  name: string;
  /** Value length only; values are never persisted. */
  valueLength: number;
  domain: string | null;
  path: string | null;
  /** Absolute expiry in epoch seconds, null for session cookies. */
  expires: number | null;
  maxAge: number | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  partitioned: boolean;
}

function parseExpires(value: string): number | null {
  // Some servers emit dashes ("Thu, 01-Jan-2030 00:00:00 GMT"), which Date.parse also accepts once normalised.
  const ms = Date.parse(value.replace(/-/g, " "));
  if (Number.isNaN(ms)) {
    const fallback = Date.parse(value);
    return Number.isNaN(fallback) ? null : Math.floor(fallback / 1000);
  }
  return Math.floor(ms / 1000);
}

function normalizeSameSite(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v === "strict") return "Strict";
  if (v === "lax") return "Lax";
  if (v === "none") return "None";
  return null;
}

/** Parses one Set-Cookie header line. Returns null for malformed lines (no name=value pair). */
export function parseSetCookieLine(line: string, nowSeconds = Math.floor(Date.now() / 1000)): ParsedSetCookie | null {
  const parts = line.split(";");
  const pair = parts.shift();
  if (!pair) return null;
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  if (!name || /[\s,;]/.test(name)) return null;
  let value = pair.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);

  const cookie: ParsedSetCookie = {
    name,
    valueLength: value.length,
    domain: null,
    path: null,
    expires: null,
    maxAge: null,
    secure: false,
    httpOnly: false,
    sameSite: null,
    partitioned: false,
  };

  for (const raw of parts) {
    const attr = raw.trim();
    if (!attr) continue;
    const i = attr.indexOf("=");
    const key = (i === -1 ? attr : attr.slice(0, i)).trim().toLowerCase();
    const val = i === -1 ? "" : attr.slice(i + 1).trim();
    switch (key) {
      case "domain":
        if (val) cookie.domain = val.toLowerCase();
        break;
      case "path":
        cookie.path = val || "/";
        break;
      case "expires":
        if (cookie.maxAge === null) cookie.expires = parseExpires(val);
        break;
      case "max-age": {
        const n = Number.parseInt(val, 10);
        if (Number.isFinite(n) && /^-?\d+$/.test(val)) {
          cookie.maxAge = n;
          // Max-Age wins over Expires (RFC 6265 §5.3 step 3).
          cookie.expires = n <= 0 ? nowSeconds : nowSeconds + n;
        }
        break;
      }
      case "secure":
        cookie.secure = true;
        break;
      case "httponly":
        cookie.httpOnly = true;
        break;
      case "samesite":
        cookie.sameSite = normalizeSameSite(val);
        break;
      case "partitioned":
        cookie.partitioned = true;
        break;
      default:
        break;
    }
  }
  return cookie;
}

/** Parses a header value that may contain several cookies separated by newlines. */
export function parseSetCookieHeader(header: string | undefined | null, nowSeconds?: number): ParsedSetCookie[] {
  if (!header) return [];
  return header
    .split(/\r?\n/)
    .map((line) => parseSetCookieLine(line, nowSeconds))
    .filter((c): c is ParsedSetCookie => c !== null);
}

/** Case-insensitive lookup of the set-cookie entry in a CDP / puppeteer header map. */
export function getSetCookieHeader(headers: Record<string, string> | undefined | null): string | null {
  if (!headers) return null;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "set-cookie") return v;
  }
  return null;
}
