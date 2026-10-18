import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Where the SDK and published configs are served from: NEXT_PUBLIC_CDN_URL (e.g. https://cdn.theplaintheory.in
 * once the custom domain is live), else the distribution's own CloudFront host. Both are allowed, so a
 * switch never blocks a page that still loads from the other.
 */
const CLOUDFRONT = "https://d34dtur9cre43o.cloudfront.net";
const CDN_HOSTS = [...new Set([(process.env.NEXT_PUBLIC_CDN_URL || CLOUDFRONT).replace(/\/$/, ""), CLOUDFRONT])].join(" ");

/**
 * Content Security Policy for the app and marketing site (SOC 2 CC6.6, CC6.8).
 * - Scripts and styles are first-party; 'unsafe-inline' is needed for Next's hydration and JSON-LD
 *   until we move to per-request nonces. 'unsafe-eval' only in development (React refresh).
 * - Stripe Checkout and the customer portal are top-level navigations, so they need no script or frame
 *   allowance. They do need form-action: the billing forms POST to our API, which redirects to Stripe,
 *   and browsers apply form-action to every redirect of a form submission.
 * - The /demo store and the public consent API are excluded: the demo deliberately loads third-party
 *   trackers to show blocking, and the API is called cross-origin from customer sites.
 */
const csp = [
  "default-src 'self'",
  // our own consent SDK and its config are served from the SDK CDN (see the root layout)
  `script-src 'self' 'unsafe-inline' ${CDN_HOSTS}${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // the SDK posts consent to the canonical API, so preview deployments can record it too
  `connect-src 'self' ${CDN_HOSTS} https://www.theplaintheory.in${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
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
  // Not inlined: inlining put our 143 KB of CSS in every page three times (a <style> tag plus twice in
  // the RSC payload, ~690 KB of HTML per page). As one cached file, pages are ~260 KB, first paint is
  // 120-380 ms sooner on mobile, and returning visitors don't download it again (measured 2026-10-18).
  experimental: { inlineCss: false },
  // The contact forms used to live on their own pages; they are now topics of one /contact page.
  async redirects() {
    return [
      { source: "/contact-sales", destination: "/contact?topic=sales", permanent: true },
      { source: "/contact/support", destination: "/contact?topic=support", permanent: true },
      { source: "/contact/enterprise", destination: "/contact?topic=enterprise", permanent: true },
      { source: "/contact/partners", destination: "/contact?topic=partners", permanent: true },
      // Short and familiar addresses people type or link to
      { source: "/dpdp", destination: "/compliance/dpdpa", permanent: true },
      { source: "/dpdpa", destination: "/compliance/dpdpa", permanent: true },
      { source: "/gdpr", destination: "/compliance/gdpr", permanent: true },
      { source: "/uk-gdpr", destination: "/compliance/gdpr", permanent: true },
      { source: "/ccpa", destination: "/compliance/ccpa", permanent: true },
      { source: "/cpra", destination: "/compliance/ccpa", permanent: true },
      { source: "/regulations", destination: "/compliance", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/privacy-policy", destination: "/legal/privacy", permanent: true },
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/terms-of-service", destination: "/legal/terms", permanent: true },
      { source: "/cookies", destination: "/legal/cookies", permanent: true },
      { source: "/cookie-policy", destination: "/legal/cookies", permanent: true },
      { source: "/legal", destination: "/legal/terms", permanent: false },
      { source: "/documentation", destination: "/docs", permanent: true },
      { source: "/plans", destination: "/pricing", permanent: true },
      // Account pages live under /auth. The old short addresses (and their sub-pages) keep working;
      // query strings such as ?next= and ?email= carry over.
      { source: "/login", destination: "/auth/login", permanent: true },
      { source: "/login/:path*", destination: "/auth/login/:path*", permanent: true },
      { source: "/signup", destination: "/auth/signup", permanent: true },
      { source: "/signup/:path*", destination: "/auth/signup/:path*", permanent: true },
      { source: "/forgot-password", destination: "/auth/forgot-password", permanent: true },
      { source: "/reset-password", destination: "/auth/reset-password", permanent: true },
      { source: "/register", destination: "/auth/signup", permanent: true },
      { source: "/sign-up", destination: "/auth/signup", permanent: true },
      { source: "/sign-in", destination: "/auth/login", permanent: true },
      { source: "/signin", destination: "/auth/login", permanent: true },
    ];
  },
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
