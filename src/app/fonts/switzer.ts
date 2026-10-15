import localFont from "next/font/local";

/**
 * Switzer (Indian Type Foundry, Fontshare), the brand face for the website, sign-in, dashboard and staff
 * console. Self-hosted, so no page makes a third-party font request. The root layout sets
 * `switzer.variable` on <html>; marketing also applies it with the `mk` class.
 */
export const switzer = localFont({
  src: [
    { path: "./switzer-400.woff2", weight: "400", style: "normal" },
    { path: "./switzer-500.woff2", weight: "500", style: "normal" },
    { path: "./switzer-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-switzer-face",
  display: "swap",
});
