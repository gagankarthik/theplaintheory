import { gsap } from "gsap";

/**
 * Shared GSAP entry point for UI interactions (scroll motion lives in components/marketing/motion.tsx).
 * Every interaction checks `reducedMotion()` first and falls back to an instant state change.
 */
export { gsap };

export const reducedMotion = () => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Brand easing: a weighty settle, matching --ease-spring in globals.css. */
export const EASE = "expo.out";

/**
 * Cascade a container's marked children (or direct children) into place. Opacity, not autoAlpha:
 * elements stay focusable mid-animation, so focus management never fights the motion.
 */
export function cascadeIn(root: Element | null, { x = 0, y = 14, stagger = 0.05, selector = "[data-anim]" } = {}) {
  if (!root || reducedMotion()) return;
  const targets = root.querySelectorAll(selector);
  gsap.fromTo(
    targets.length ? targets : root.children,
    { opacity: 0, x, y },
    { opacity: 1, x: 0, y: 0, duration: 0.55, ease: EASE, stagger, overwrite: true, clearProps: "transform,opacity" },
  );
}
