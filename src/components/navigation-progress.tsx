"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/**
 * A thin bar along the top of the window while the next page loads. It starts the moment an internal
 * link is clicked (or the browser goes back/forward), creeps towards 90% while the server renders,
 * and completes when the new URL commits. Fast navigations finish before it's visible, so it only
 * shows when there's actually a wait. Decorative: screen readers get each page's own loading status.
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const showDelay = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimers = () => {
    if (timer.current) clearInterval(timer.current);
    if (showDelay.current) clearTimeout(showDelay.current);
    timer.current = showDelay.current = null;
  };

  // A new URL committed: finish the bar and fade it out.
  const url = `${pathname}?${search}`;
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    if (progress !== null) setProgress(100);
  }
  useEffect(() => {
    if (progress !== 100) return;
    stopTimers();
    const t = setTimeout(() => setProgress(null), 220);
    return () => clearTimeout(t);
  }, [progress]);

  useEffect(() => {
    const start = () => {
      stopTimers();
      // only show for waits longer than a blink
      showDelay.current = setTimeout(() => {
        setProgress(8);
        timer.current = setInterval(() => setProgress((p) => (p === null || p >= 90 ? p : p + (90 - p) * 0.12)), 200);
      }, 120);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let next: URL;
      try {
        next = new URL(href, location.href);
      } catch {
        return;
      }
      if (next.origin !== location.origin) return;
      // same page (only the hash differs): nothing loads
      if (next.pathname === location.pathname && next.search === location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      removeEventListener("popstate", start);
      stopTimers();
    };
  }, []);

  if (progress === null) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="nav-progress h-full bg-marker shadow-[0_0_8px_var(--color-marker)]"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}

export function NavigationProgress() {
  // useSearchParams needs a Suspense boundary so static pages can still prerender
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
