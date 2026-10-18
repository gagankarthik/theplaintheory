"use client";

import { IconArrowRight } from "@/components/icons";

/** Back to the top of the page, then focus the main content so keyboard users land there too. */
export function BackToTop() {
  return (
    <button
      type="button"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
      className="group inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full text-[0.9375rem] text-white/85 transition-colors hover:text-white"
    >
      Back to top
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors duration-200 group-hover:bg-lime group-hover:text-soot">
        <IconArrowRight size={18} className="-rotate-90 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5" />
      </span>
    </button>
  );
}
