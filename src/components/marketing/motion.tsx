"use client";

import { usePathname } from "next/navigation";
import { Fragment, useEffect } from "react";

/**
 * Scroll reveals for the marketing site. Anything marked `data-reveal` starts at rest without
 * JavaScript and for reduced motion. With motion allowed, the root gets `.mk-motion`, blocks already
 * on screen are marked shown at once (no flash), and the rest rise in as they enter the viewport.
 * `data-reveal="words"` lifts each word of a <Words> heading out of its own mask instead.
 */
export function MotionRoot() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])"));
    const vh = window.innerHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.setAttribute("data-in", "");
    }
    document.documentElement.classList.add("mk-motion");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    for (const el of els) if (!el.hasAttribute("data-in")) io.observe(el);
    return () => io.disconnect();
  }, [pathname]);
  return null;
}

/**
 * A heading's text split into words, each in its own mask, so the line rises into place word by word.
 * Screen readers get the plain sentence; the split copy is hidden from them.
 */
export function Words({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className={`mk-words ${className}`}>
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className="mk-w">
              <span style={{ "--wi": i + delay } as React.CSSProperties}>{w}</span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </>
  );
}
