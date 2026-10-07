"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll motion for the marketing site, driven by GSAP. Pages opt in with markers, so content is
 * fully visible without JavaScript and nothing moves for reduced-motion users:
 *
 * - `.pt-reveal`           rises and sharpens into place once (replaces the CSS fallback while active)
 * - `[data-gsap-stagger]`  its children cascade in, one after another
 * - `[data-gsap-bar]`      grows from the left, like a measurement being drawn
 * - `[data-gsap-parallax]` drifts slightly slower than the page (value = distance in px)
 * - `[data-gsap-settle]`   scales up a touch as it arrives
 */
export function MarketingMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      document.documentElement.classList.add("gsap-on");
      const once = (trigger: Element, start = "top 88%") => ({ trigger, start, once: true });

      gsap.utils.toArray<HTMLElement>(".pt-reveal").forEach((el) => {
        gsap.from(el, { y: 32, autoAlpha: 0, filter: "blur(6px)", duration: 0.9, ease: "expo.out", clearProps: "filter", scrollTrigger: once(el) });
      });

      gsap.utils.toArray<HTMLElement>("[data-gsap-stagger]").forEach((list) => {
        gsap.from(list.children, {
          y: 24,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: { each: 0.07, from: "start" },
          scrollTrigger: once(list, "top 85%"),
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-gsap-bar]").forEach((bar) => {
        gsap.from(bar, { scaleX: 0, transformOrigin: "left center", duration: 1.1, ease: "power4.out", scrollTrigger: once(bar, "top 92%") });
      });

      gsap.utils.toArray<HTMLElement>("[data-gsap-parallax]").forEach((el) => {
        const distance = Number(el.dataset.gsapParallax) || 60;
        gsap.to(el, { y: -distance, ease: "none", scrollTrigger: { trigger: el, start: "top top+=120", end: "bottom top", scrub: 0.6 } });
      });

      gsap.utils.toArray<HTMLElement>("[data-gsap-settle]").forEach((el) => {
        gsap.from(el, { scale: 0.94, autoAlpha: 0.4, duration: 1.2, ease: "expo.out", scrollTrigger: once(el, "top 90%") });
      });

      return () => document.documentElement.classList.remove("gsap-on");
    });

    // Fonts and late images change section heights; measure again once they've settled.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
    };
  }, [pathname]);

  return null;
}
