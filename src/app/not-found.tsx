import type { Metadata } from "next";
import Link from "next/link";
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

/** 404 for every unmatched URL, with the marketing chrome so visitors can carry on. */
export default function NotFound() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="nf-title" className="border-b border-line bg-surface">
          <div className="container-page py-24 md:py-32">
            <p className="font-mono text-sm text-ink-3">404</p>
            <h1 id="nf-title" className="display mt-4 max-w-[18ch] text-[2.5rem] sm:text-[3.25rem]">
              This page isn&apos;t here
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg text-ink-2">
              The link may be out of date, or the page has moved. Check the address, or pick up from one of these.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <CtaButton href="/">Go to the home page</CtaButton>
              <Link href="/contact-sales" className="btn btn-pill btn-lg btn-ghost">
                Contact us
              </Link>
            </div>

            <ul className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {PLACES.map((p) => (
                <li key={p.href} className="bg-surface">
                  <Link href={p.href} className="group block h-full p-6 transition-colors hover:bg-paper">
                    <span className="font-semibold group-hover:text-brand">{p.title}</span>
                    <span className="mt-2 block text-sm text-ink-2">{p.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
