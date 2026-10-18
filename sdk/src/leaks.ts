import { findPattern } from "./match";
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
  /** `held`: the request came from a <script> tag the SDK is holding, i.e. the browser's preloader
   * fetched it from the HTML before any script could run; it was downloaded but never executed. */
  report: (url: string, category: CategoryId, held: boolean) => void,
) {
  const seen = new Set<string>();
  const clean = (u: string) => u.split(/[?#]/)[0];
  const heldSrcs = () =>
    new Set(
      [...document.querySelectorAll("script[src],script[data-plain-src]")]
        .filter(isHeldScript)
        .map((s) => {
          try {
            return clean(new URL(s.getAttribute("data-plain-src") || s.getAttribute("src") || "", location.href).href);
          } catch {
            return "";
          }
        }),
    );

  const check = (url: string | null, startedAt: number, fromTiming = false) => {
    if (!url || seen.size >= MAX_REPORTS || !/^https?:/i.test(url)) return;
    const hit = findPattern(patterns(), url);
    if (!hit) return;
    const category = hit.c as CategoryId;
    if (startedAt >= grantedAt(category)) return;
    const u = clean(url);
    if (seen.has(u)) return;
    seen.add(u);
    report(u, category, fromTiming && heldSrcs().has(u));
  };

  const checkEl = (el: Element) => {
    if ((el instanceof HTMLImageElement || el instanceof HTMLIFrameElement || el instanceof HTMLScriptElement) && !isHeldScript(el)) {
      check(el.getAttribute("src") && (el as HTMLImageElement).src, performance.now());
    }
  };

  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => check(e.name, e.startTime, true))).observe({ type: "resource", buffered: true });
  } catch {
    /* Resource Timing unavailable: element checks still run */
  }
  document.querySelectorAll("img[src],iframe[src],script[src]").forEach(checkEl);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n instanceof Element && checkEl(n)))).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
