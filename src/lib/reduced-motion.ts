/** The visitor asked for less motion (or there's no window yet): skip decorative animation. */
export const reducedMotion = () => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
