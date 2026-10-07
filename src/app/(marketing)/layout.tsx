import Script from "next/script";
import { WebAnalytics } from "@/components/analytics/web-analytics";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingMotion } from "@/components/marketing/motion";
import { SiteHeader } from "@/components/marketing/site-header";

/** Our own site's consent property: a real site in the store, set per environment. No key, no banner. */
const SITE_KEY = process.env.NEXT_PUBLIC_PLAIN_SITE_KEY || undefined;

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
      <div aria-hidden className="pt-grain" />
      <WebAnalytics />
      <MarketingMotion />
      {/* We run our own consent script. The site sets no analytics or ad cookies, so it isn't blocking-critical. */}
      {SITE_KEY ? <Script src="/sdk/plain-consent.js" data-site={SITE_KEY} strategy="afterInteractive" /> : null}
    </>
  );
}
