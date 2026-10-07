import type { Metadata } from "next";
import Link from "next/link";
import { WebAnalytics } from "@/components/analytics/web-analytics";
import { IconChevronRight } from "@/components/icons";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { CtaButton } from "@/components/marketing/primitives";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist or has moved. Find what you need from the links below.",
  robots: { index: false, follow: true },
};

const PLACES = [
  { href: "/pricing", title: "Pricing", body: "Plans in USD, EUR, GBP and INR, priced per account." },
  { href: "/docs", title: "Documentation", body: "Install the script and configure your banner." },
  { href: "/compliance/dpdpa", title: "DPDPA readiness", body: "What India's DPDP Rules ask for, and when." },
  { href: "/security", title: "Security", body: "How consent data is protected and proven." },
];

/** Oversized numerals; the size scales with the viewport so "404" fills a phone screen without overflowing it. */
const NUMERAL = "block select-none text-[clamp(8rem,40vw,16rem)] font-semibold leading-[0.8] tracking-[-0.06em] tabular-nums";

/** 404 for every unmatched URL, with the marketing chrome so visitors can carry on. */
export default function NotFound() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="nf-title" className="relative overflow-hidden border-b border-line bg-surface">
          {/* Brand wash and a faint blueprint grid, fading out towards the edges */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-[linear-gradient(180deg,var(--color-brand-wash)_0%,transparent_100%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:48px_48px] opacity-60 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_32%,black,transparent)]"
          />

          <div className="container-page relative flex flex-col items-center pb-16 pt-14 text-center sm:pb-24 sm:pt-20">
            <p className="pt-hero-in inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-mono text-xs text-ink-2 shadow-[var(--shadow-lift)] ring-1 ring-line">
              <span aria-hidden className="size-1.5 rounded-full bg-brand" />
              Error 404
            </p>

            {/* The number is the message: a brand-gradient face over an offset outline, for a little depth */}
            <div aria-hidden className="pt-hero-in relative mt-8 sm:mt-10" style={{ animationDelay: "90ms" }}>
              <span className={`${NUMERAL} absolute inset-0 translate-x-[0.035em] translate-y-[0.035em] text-transparent [-webkit-text-stroke:1.5px_var(--color-line-strong)]`}>
                404
              </span>
              <span
                className={`${NUMERAL} relative bg-[linear-gradient(160deg,var(--color-brand-bright)_10%,var(--color-brand)_45%,var(--color-brand-deep)_100%)] bg-clip-text pr-[0.04em] text-transparent`}
              >
                404
              </span>
            </div>

            <h1 id="nf-title" className="display pt-hero-in mt-8 text-[2rem] sm:mt-10 sm:text-[2.75rem]" style={{ animationDelay: "180ms" }}>
              <span className="sr-only">404: </span>This page isn&apos;t here
            </h1>
            <p className="pt-hero-in mt-4 max-w-[42ch] text-base text-ink-2 sm:text-lg" style={{ animationDelay: "240ms" }}>
              The link may be out of date, or the page has moved. Check the address, or pick up from one of these.
            </p>
            <div className="pt-hero-in mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center" style={{ animationDelay: "300ms" }}>
              <CtaButton href="/" className="justify-center">
                Go to the home page
              </CtaButton>
              <Link href="/contact-sales" className="btn btn-pill btn-lg btn-ghost">
                Contact us
              </Link>
            </div>
          </div>
        </section>

        <section aria-label="Popular pages" className="bg-paper">
          <div className="container-page py-12 sm:py-16">
            <ul className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {PLACES.map((p) => (
                <li key={p.href} className="bg-surface">
                  <Link href={p.href} className="group flex h-full items-start gap-3 p-5 transition-colors hover:bg-brand-wash/40 sm:block sm:p-6">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-semibold group-hover:text-brand">
                        {p.title}
                        <IconChevronRight size={14} className="text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" />
                      </span>
                      <span className="mt-1.5 block text-sm text-ink-2">{p.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WebAnalytics />
    </>
  );
}
