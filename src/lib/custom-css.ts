/**
 * Custom CSS for the banner. Client-safe and bundled into the SDK, so the dashboard (zod) and every
 * visitor's browser apply the same rules: the stylesheet is scoped to the banner's shadow root and
 * may restyle it, but never load anything, run anything or break out of its <style> element.
 */

export const CUSTOM_CSS_MAX = 4000;

/** Constructs that fetch resources, run code or end the style element. Matched after comments and escapes are removed. */
const BLOCKED = /@import|@charset|@namespace|url\s*\(|src\s*\(|image-set\s*\(|image\s*\(|expression\s*\(|javascript:|vbscript:|behaviou?r\s*:|-moz-binding|<\/?\s*style|<!--|-->/gi;

/** Comments can split a blocked word (u/**\/rl), escapes can spell one (u\72l), "<" can close the style element. */
const normalize = (css: string) => css.replace(/\/\*[\s\S]*?(\*\/|$)/g, "").replace(/[\\<]/g, "");

/** Blocked constructs present in `css`, lower-cased and de-duplicated, for an error message. */
export function blockedCss(css: string): string[] {
  const hits = (normalize(css).match(BLOCKED) || []).map((m) => m.toLowerCase().replace(/\s+/g, ""));
  if (/\\/.test(css)) hits.push("\\ escapes");
  if (/</.test(css)) hits.push("<");
  return [...new Set(hits)];
}

/**
 * The stylesheet as applied: capped, comments, escapes, "<" and blocked constructs removed, and
 * !important dropped so the banner's own guards (Reject stays visible) always win.
 */
export function sanitizeCss(css: string | undefined): string {
  let s = normalize(String(css || "").slice(0, CUSTOM_CSS_MAX));
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(BLOCKED, "");
  }
  return s.replace(/!\s*important/gi, "").trim();
}
