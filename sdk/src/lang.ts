import type { RegionRule } from "./types";

/**
 * Notice language selection: English, the 22 languages of the Eighth Schedule (DPDP Act s.5(3)) and
 * common global languages. Native names come from Intl.DisplayNames; ICU lacks native names for
 * these ten, so they're listed here.
 */
const NATIVE = "as অসমীয়া|brx बड़ो|doi डोगरी|ks کٲشُر|mai मैथिली|mni ꯃꯤꯇꯩꯂꯣꯟ|ne नेपाली|or ଓଡ଼ିଆ|sa संस्कृतम्|sat ᱥᱟᱱᱛᱟᱲᱤ";

export function langName(code: string): string {
  const hit = NATIVE.split("|").find((x) => x.slice(0, x.indexOf(" ")) === code);
  if (hit) return hit.slice(hit.indexOf(" ") + 1);
  try {
    const n = new Intl.DisplayNames([code], { type: "language" }).of(code) || code;
    return n[0].toUpperCase() + n.slice(1);
  } catch {
    return code;
  }
}

/** Urdu, Kashmiri and Sindhi are written right to left. */
export const isRtl = (code: string) => /^(ur|ks|sd)(-|$)/.test(code);

const base = (c: string) => c.toLowerCase().split("-")[0];

/**
 * Pick a translation for this region: an explicit choice first, then the page's <html lang>, then the
 * browser's languages. Matches exact codes and then base languages ("hi-IN" → "hi"). Returns
 * undefined to use the region's default copy, including when the page is already in that language.
 */
export function pickLang(rule: RegionRule, preferred?: string | null): string | undefined {
  const t = rule.translations as Record<string, unknown> | undefined;
  if (!t) return;
  const candidates = [preferred, document.documentElement.lang, ...(navigator.languages || [navigator.language])];
  for (const raw of candidates) {
    if (!raw) continue;
    const c = raw.toLowerCase();
    if (t[c]) return c;
    if (t[base(c)]) return base(c);
    if (base(c) === base(rule.language)) return;
  }
}
