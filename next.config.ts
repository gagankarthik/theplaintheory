import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy for the app and marketing site (SOC 2 CC6.6, CC6.8).
 * - Scripts and styles are first-party; 'unsafe-inline' is needed for Next's hydration and JSON-LD
 *   until we move to per-request nonces. 'unsafe-eval' only in development (React refresh).
 * - Stripe Checkout is a top-level navigation, so it needs no script or frame allowance here.
 * - The /demo store and the public consent API are excluded: the demo deliberately loads third-party
 *   trackers to show blocking, and the API is called cross-origin from customer sites.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // Keep the dev badge clear of the "Privacy choices" button (bottom right on our own site).
  devIndicators: { position: "bottom-left" },
  poweredByHeader: false,
  async headers() {
    return [
      // Everything except the demo store, the public consent API and the SDK bundle
      { source: "/((?!demo|api/v1|sdk/).*)", headers: securityHeaders },
      // Baseline hardening that applies everywhere, including the public endpoints
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Private app surfaces are never cached by shared caches
      { source: "/app/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
