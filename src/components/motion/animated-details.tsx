"use client";

import { useRef, type ReactNode } from "react";
import { EASE, gsap, reducedMotion } from "@/lib/motion";

/**
 * Native <details> whose body eases open and shut. Without JavaScript, or with reduced motion, it's a
 * plain <details>: keyboard and screen-reader behaviour come from the browser either way.
 */
export function AnimatedDetails({ summary, children, className = "", summaryClassName = "" }: { summary: ReactNode; children: ReactNode; className?: string; summaryClassName?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);

  const toggle = (e: React.MouseEvent) => {
    const d = ref.current;
    const b = body.current;
    if (!d || !b || reducedMotion()) return;
    e.preventDefault();
    gsap.killTweensOf(b);
    if (!d.open) {
      d.open = true;
      gsap.fromTo(b, { height: 0, autoAlpha: 0 }, { height: "auto", autoAlpha: 1, duration: 0.5, ease: EASE, clearProps: "height,opacity,visibility" });
    } else {
      gsap.to(b, {
        height: 0,
        autoAlpha: 0,
        duration: 0.35,
        ease: "power3.inOut",
        onComplete: () => {
          d.open = false;
          gsap.set(b, { clearProps: "height,opacity,visibility" });
        },
      });
    }
  };

  return (
    <details ref={ref} className={className}>
      <summary onClick={toggle} className={summaryClassName}>
        {summary}
      </summary>
      <div ref={body} className="overflow-hidden">
        {children}
      </div>
    </details>
  );
}
