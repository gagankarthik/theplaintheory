import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { MarketingMotion } from "@/components/marketing/motion";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Account pages (sign up, verify, sign in, password reset) as full site pages: the marketing header
 * and footer around one centred form card.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
      <main id="main" tabIndex={-1} className="relative overflow-hidden bg-paper outline-none">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,var(--color-brand-wash),transparent)]" />
        <div className="container-page relative flex justify-center py-10 sm:py-16 lg:py-20">
          <div className="w-full max-w-[640px] rounded-[24px] bg-surface p-6 shadow-[var(--shadow-float)] ring-1 ring-line sm:p-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
      <div aria-hidden className="pt-grain" />
      <MarketingMotion />
    </>
  );
}
