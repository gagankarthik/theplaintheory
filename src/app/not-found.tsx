import type { Metadata } from "next";
import Link from "next/link";
import { WebAnalytics } from "@/components/analytics/web-analytics";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { switzer } from "./fonts/switzer";
import "./(marketing)/marketing.css";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist or has moved. Find what you need from the links below.",
  robots: { index: false, follow: true },
  // a missing page has no canonical of its own (never the home page's)
  alternates: { canonical: null },
};

const PLACES = [
  { href: "/pricing", title: "Pricing", body: "Plans in USD, EUR, GBP and INR, priced per account." },
  { href: "/docs", title: "Documentation", body: "Install the script and configure your banner." },
  { href: "/compliance/dpdpa", title: "DPDPA readiness", body: "What the DPDP Act and Rules ask for, and when." },
  { href: "/contact", title: "Contact", body: "Sales, support, partners and enterprise." },
];

/** 404 for every unmatched URL, with the marketing bar and footer so visitors can carry on. */
export default function NotFound() {
  return (
    <div className={`mk ${switzer.variable}`}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="nf-title" className="bg-soot px-5 pb-14 pt-10 text-white sm:px-8 md:pb-20">
          <div className="mk-fade mx-auto max-w-[1440px]">
            <p aria-hidden className="text-[clamp(6rem,20vw,16rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-lime">
              404
            </p>
            <h1 id="nf-title" className="mt-8 text-[clamp(2.25rem,4.2vw,3.75rem)]">
              <span className="sr-only">404: </span>This page isn’t here.
            </h1>
            <p className="mt-4 max-w-[48ch] text-[1.125rem] leading-[1.55]">The link may be out of date, or the page has moved. Check the address, or pick up from one of these.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className="mk-stem mk-stem-lime">
                Go to the home page
              </Link>
              <Link href="/contact" className="mk-stem mk-stem-white">
                Contact us
              </Link>
            </div>
          </div>
        </section>
        <section aria-label="Popular pages" className="on-light bg-white px-5 py-12 sm:px-8">
          <ul className="mx-auto grid max-w-[1440px] gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PLACES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="block h-full rounded-[18px] bg-chalk p-6 transition-colors hover:bg-lime">
                  <span className="block text-[1.25rem] font-semibold tracking-[-0.025em]">{p.title}</span>
                  <span className="mt-2 block text-[1rem]">{p.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
      <WebAnalytics />
    </div>
  );
}
