import type { CategoryId } from "./types";

/**
 * Clears cookies and web storage the site catalogued under a category the visitor hasn't allowed:
 * before a decision, after "Reject", and when consent is withdrawn. Blocking stops new trackers from
 * running; this removes what's already there (a first-party script's cookie, or _ga left over from
 * before a withdrawal). Cookies are cleared on this host and each parent domain, where analytics
 * tools usually set them. HttpOnly cookies can't be read by scripts and are left alone.
 */

type Rule = { n: string; c: CategoryId };
let rules: { re: RegExp; c: CategoryId }[] = [];

const toRe = (p: string) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");

export function setCookieRules(list: Rule[] | undefined) {
  rules = (list ?? []).map((r) => ({ re: toRe(r.n), c: r.c }));
}

export function clearDenied(allowed: (c: CategoryId) => boolean) {
  const denied = rules.filter((r) => !allowed(r.c));
  if (!denied.length) return;
  const hit = (name: string) => denied.some((r) => r.re.test(name));
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0].trim();
    if (!name || !hit(name)) continue;
    for (const d of domains) document.cookie = `${name}=;Expires=Thu, 01 Jan 1970 00:00:00 GMT;Max-Age=0;Path=/${d ? ";Domain=" + d : ""}`;
  }
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (let i = store.length - 1; i >= 0; i--) {
        const k = store.key(i);
        if (k && hit(k)) store.removeItem(k);
      }
    } catch {
      /* storage blocked */
    }
  }
}
