import localFont from "next/font/local";

/**
 * Switzer (Indian Type Foundry, Fontshare), the marketing and sign-in face. Self-hosted, so public pages
 * make no third-party font request. Apply `switzer.variable` together with the `mk` class.
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
