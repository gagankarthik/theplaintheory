/**
 * Small, dependency-free HTML reading for the live site check. It is not a full parser: it reads
 * what a server sent, which is what a visitor sees before any JavaScript runs.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  bull: "•",
  rupee: "₹",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

const BLOCK = /<\/?(?:p|div|section|article|aside|header|footer|nav|main|li|ul|ol|dl|dt|dd|h[1-6]|table|tr|td|th|thead|tbody|blockquote|address|form|fieldset|figure|figcaption|details|summary|br|hr|pre)\b[^>]*>/gi;

/** Remove elements whose content is never shown as page text. */
export function stripInvisible(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|head|iframe|object|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(script|style|noscript|template|svg|head)\b[^>]*\/?>/gi, " ");
}

/** Visible text of a page: one line per block, whitespace collapsed. */
export function htmlToText(html: string): string {
  const withBreaks = stripInvisible(html).replace(BLOCK, "\n").replace(/<[^>]+>/g, " ");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((l) => l.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** The value of one attribute in an opening tag string. */
export function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  if (!m) return undefined;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "");
}

export interface PageLink {
  /** absolute URL, without the fragment */
  href: string;
  /** visible text, or the aria-label / title when there's none */
  text: string;
  hreflang?: string;
}

export function extractLinks(html: string, base: string | URL): PageLink[] {
  const out: PageLink[] = [];
  const clean = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  for (const m of clean.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const tag = ` ${m[1]}`;
    const raw = attr(tag, "href");
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw.trim(), base);
    } catch {
      continue;
    }
    url.hash = "";
    const inner = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const text = inner || attr(tag, "aria-label") || attr(tag, "title") || "";
    out.push({ href: url.toString(), text, hreflang: attr(tag, "hreflang")?.toLowerCase() });
  }
  return out;
}

export interface PageScript {
  src?: string;
  type?: string;
  inline: string;
}

export function extractScripts(html: string): PageScript[] {
  const clean = html.replace(/<!--[\s\S]*?-->/g, " ");
  return [...clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map((m) => ({
    src: attr(` ${m[1]}`, "src"),
    type: attr(` ${m[1]}`, "type")?.toLowerCase(),
    inline: m[2],
  }));
}

/** Scripts the browser runs as it loads the page. CMPs hold trackers back with type="text/plain". */
export function isExecutable(s: PageScript) {
  return !s.type || /^(text|application)\/(javascript|ecmascript|x-javascript)$|^module$/.test(s.type);
}

export function htmlLang(html: string): string | undefined {
  const tag = html.match(/<html\b[^>]*>/i)?.[0];
  return tag ? attr(tag, "lang")?.trim().toLowerCase() || undefined : undefined;
}

/** hreflang values from <link rel="alternate"> and language-switcher links. */
export function hreflangs(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/<(?:link|a)\b[^>]*>/gi)) {
    const v = attr(m[0], "hreflang");
    if (v) set.add(v.trim().toLowerCase());
  }
  return [...set];
}

export function pageTitle(html: string) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : undefined;
}

/** A quote of at most `max` characters around [start, end), cut at word boundaries. */
export function quoteAround(text: string, start: number, end: number, max = 200): string {
  const flat = (s: string) => s.replace(/\s+/g, " ");
  const matchLen = end - start;
  if (matchLen >= max) return flat(text.slice(start, start + max - 1)).trim() + "…";
  const room = max - matchLen - 2;
  let a = Math.max(0, start - Math.floor(room / 2));
  let b = Math.min(text.length, end + (room - (start - a)));
  a = Math.max(0, Math.min(a, b - (max - 2)));
  // snap to word boundaries
  if (a > 0) {
    const sp = text.indexOf(" ", a);
    if (sp !== -1 && sp < start) a = sp + 1;
  }
  if (b < text.length) {
    const sp = text.lastIndexOf(" ", b);
    if (sp > end) b = sp;
  }
  const body = flat(text.slice(a, b)).trim();
  return `${a > 0 ? "…" : ""}${body}${b < text.length ? "…" : ""}`;
}
