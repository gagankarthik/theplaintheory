import Script from "next/script";
import { preconnect } from "react-dom";
import { WebAnalytics } from "@/components/analytics/web-analytics";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { MotionRoot } from "@/components/marketing/motion";
import { CDN_ORIGIN } from "@/lib/install-snippets";
import { switzer } from "../fonts/switzer";
import "./marketing.css";

/** Our own consent property: the SDK and its published config come from the SDK CDN (one setting, see install-snippets). */
const SDK_CDN = CDN_ORIGIN;
const SITE_KEY = process.env.NEXT_PUBLIC_PLAIN_SITE_KEY || "pk_cCHNxnAZH9iKfdjV";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // open the connection to the SDK CDN with the HTML
  preconnect(SDK_CDN, { crossOrigin: "anonymous" });
  return (
    <div className={`mk ${switzer.variable}`}>
      <a
        href="#main"
        className="sr-only z-[100] rounded-full bg-lime px-4 py-2 text-sm font-medium text-soot focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
      <MotionRoot />
      <WebAnalytics />
      {/*
        Our own consent banner, on the public site only (the dashboard, sign-in and staff console set only
        essential cookies). The site sets no analytics or ad cookies before consent, so it isn't blocking-critical.
        The floating Privacy choices button shows on the landing page only (globals.css); everywhere else the
        footer's Cookie settings reopens the choices.
      */}
      <Script
        src={`${SDK_CDN}/sdk/v1/plain-consent.js`}
        data-site={SITE_KEY}
        data-api="https://www.theplaintheory.in/api/v1"
        data-config-url={`${SDK_CDN}/c/${SITE_KEY}.json`}
        data-gcm="true"
        strategy="afterInteractive"
      />
    </div>
  );
}
