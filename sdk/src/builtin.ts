/**
 * Trackers held from the first instant, before the site's own list arrives with the config.
 * Each is a URL pattern of a tracker in the catalogue (src/lib/tracker-db.ts) with that entry's
 * category; tests/sdk/builtin.test.ts fails if one drifts. Kept as literals rather than imported
 * so the SDK doesn't bundle the whole catalogue.
 */
export const BUILTIN: { p: string; c: string }[] = [
  ["googletagmanager.com/gtag", "analytics"],
  ["google-analytics.com", "analytics"],
  ["static.hotjar.com", "analytics"],
  ["clarity.ms", "analytics"],
  ["connect.facebook.net", "marketing"],
  ["snap.licdn.com", "marketing"],
  ["analytics.tiktok.com", "marketing"],
  ["googleadservices.com", "marketing"],
].map(([p, c]) => ({ p, c }));
