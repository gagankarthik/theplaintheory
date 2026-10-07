"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, reducedMotion } from "@/lib/motion";

/**
 * Leans its child toward the pointer and springs back on leave. Mouse and pen only: touch has no
 * hover, and keyboard focus never moves anything. An inner `[data-magnetic-knob]` travels further,
 * which gives the arrow its own little lead.
 */
export function Magnetic({ children, strength = 0.22, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const knob = el.querySelector<HTMLElement>("[data-magnetic-knob]");
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    const kxTo = knob ? gsap.quickTo(knob, "x", { duration: 0.4, ease: "power3.out" }) : null;
    const kyTo = knob ? gsap.quickTo(knob, "y", { duration: 0.4, ease: "power3.out" }) : null;

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      xTo(dx * strength);
      yTo(dy * strength);
      kxTo?.(dx * strength * 0.6);
      kyTo?.(dy * strength * 0.6);
    };
    const leave = () => {
      gsap.to(knob ? [el, knob] : el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)", overwrite: true });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(knob ? [el, knob] : el);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`inline-flex will-change-transform ${className}`}>
      {children}
    </span>
  );
}
