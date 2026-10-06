import type { CategoryId } from "./types";

/**
 * Leak detection: notice tracker requests that happen without consent, in real visitors' browsers.
 *
 * A request is a leak when it matches a tracker pattern and its category had not been granted when
 * the request started: before a choice in opt-in regions, or after a decline. Requests that start
 * after the category is granted are never reported.
 *
 * Sources: Resource Timing (buffered, so requests made before this ran are included) and, for
 * requests that fail before producing a timing entry, <img>/<iframe>/<script> elements added to the
 * page. Each URL (query string removed) is reported once per page view, at most 5 per page.
 */
type Pattern = { p: string; c: string };

const MAX_REPORTS = 5;
const isHeldScript = (el: Element) => el instanceof HTMLScriptElement && (el.type === "text/plain" || el.hasAttribute("data-plain-src"));

export function watchLeaks(
  patterns: () => Pattern[],
  /** performance.now() at which the category became allowed; Infinity while it isn't */
  grantedAt: (c: CategoryId) => number,
  report: (url: string, category: CategoryId) => void,
) {
  const seen = new Set<string>();

  const check = (url: string | null, startedAt: number) => {
    if (!url || seen.size >= MAX_REPORTS || !/^https?:/i.test(url)) return;
    const hit = patterns().find((t) => t.c !== "essential" && url.indexOf(t.p) > -1);
    if (!hit) return;
    const category = hit.c as CategoryId;
    if (startedAt >= grantedAt(category)) return;
    const clean = url.split(/[?#]/)[0];
    if (seen.has(clean)) return;
    seen.add(clean);
    report(clean, category);
  };

  const checkEl = (el: Element) => {
    if ((el instanceof HTMLImageElement || el instanceof HTMLIFrameElement || el instanceof HTMLScriptElement) && !isHeldScript(el)) {
      check(el.getAttribute("src") && (el as HTMLImageElement).src, performance.now());
    }
  };

  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => check(e.name, e.startTime))).observe({ type: "resource", buffered: true });
  } catch {
    /* Resource Timing unavailable: element checks still run */
  }
  document.querySelectorAll("img[src],iframe[src],script[src]").forEach(checkEl);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n instanceof Element && checkEl(n)))).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
