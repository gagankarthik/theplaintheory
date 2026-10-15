/**
 * Tracker URL patterns, matched against the parsed address rather than as substrings, so a tracker
 * host in a query string (?ref=connect.facebook.net) or another site's path never matches.
 *   "host.com"        that host or any subdomain of it
 *   "host.com/path"   that host (or a subdomain) and a path starting with /path
 *   "/path"           any host, a path containing /path (first-party endpoints)
 * A pattern with no dot in its host part (a customer's free-form entry) matches host + path as a substring.
 * Same rules as urlPatternMatches in src/lib/tracker-db.ts.
 */
export function toUrl(src: string | null | undefined): URL | null {
  if (!src) return null;
  try {
    const u = new URL(src, location.href);
    return /^https?:$/.test(u.protocol) ? u : null;
  } catch {
    return null;
  }
}

export function matchesPattern(u: URL, pattern: string): boolean {
  const p = pattern
    .trim()
    .toLowerCase()
    .replace(/^[a-z][\w+.-]*:\/\/|^\/\//, "")
    .replace(/^\*\./, "");
  if (!p) return false;
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (p[0] === "/") return path.indexOf(p) > -1;
  const slash = p.indexOf("/");
  const h = slash < 0 ? p : p.slice(0, slash);
  if (h.indexOf(".") < 0) return (host + path).indexOf(p) > -1;
  if (host !== h && !host.endsWith("." + h)) return false;
  return slash < 0 || path.startsWith(p.slice(slash));
}

/** The first non-essential pattern matching `src`, or undefined. */
export function findPattern<T extends { p: string; c: string }>(list: T[], src: string | null | undefined): T | undefined {
  const u = toUrl(src);
  if (!u) return;
  for (const t of list) if (t.c !== "essential" && matchesPattern(u, t.p)) return t;
}
