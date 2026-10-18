import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { site } from "@/lib/site";
import { BackToTop } from "./back-to-top";
import { CookieSettingsButton } from "./cookie-settings-button";
import { COMPLIANCE_LINKS, CONTACT, INDUSTRY_LINKS, LEGAL, PLATFORM, RESOURCE_LINKS } from "./site-nav";

const COLUMNS: { label: string; links: { href: string; title: string }[] }[] = [
  { label: "Platform", links: [...PLATFORM.groups[0].links, ...PLATFORM.groups[1].links, ...PLATFORM.groups[2].links.slice(0, 1)] },
  { label: "Industries", links: INDUSTRY_LINKS },
  { label: "Compliance", links: COMPLIANCE_LINKS },
  { label: "Resources", links: [...RESOURCE_LINKS, { href: "/brand", title: "Brand" }] },
  {
    label: "Company",
    links: [
      { href: CONTACT.href, title: "Contact us" },
      { href: "/contact?topic=sales", title: "Talk to sales" },
      { href: "/contact?topic=support", title: "Support" },
      { href: "/contact?topic=enterprise", title: "Enterprise" },
      { href: "/contact?topic=partners", title: "Partners" },
    ],
  },
];

/** The legal documents only. The picture credits page stays published (and in the sitemap), just not listed here. */
const LEGAL_LINKS = LEGAL.filter((l) => l.href !== "/legal/credits");

const LINK = "inline-flex min-h-10 items-center text-left text-[0.875rem] leading-snug text-white/75 transition-colors duration-150 hover:text-white sm:min-h-8";
const HEADING = "text-[0.75rem] font-medium uppercase tracking-[0.08em] text-mute";

/**
 * The close of every marketing page, call to action and footer in one soot block. It opens with one
 * sentence with a blank: the blank is the email field, the last word is the button, and the form opens
 * sign-up with the address filled in. Then the brand and contacts, the site map in six ruled columns
 * (Legal last), a one-line disclaimer, and the copyright with a way back to the top.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer aria-labelledby="footer-title" className="relative isolate overflow-hidden bg-soot text-white">
      <h2 id="footer-title" className="sr-only">
        Site footer
      </h2>
      {/* the ring once more, as an outline, behind the sentence and cropped by the edge */}
      <svg aria-hidden viewBox="0 0 120 120" className="pointer-events-none absolute -right-[22%] -top-[8%] -z-10 w-[min(80vw,760px)] text-white/[0.05] md:-right-[8%] md:-top-[14%]">
        <circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="34" />
      </svg>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        {/* Call to action */}
        <form action="/auth/signup" method="get" data-reveal className="pb-14 pt-16 md:pb-20 md:pt-24">
          {/* A wrapping row with real gaps, so the phrase, the field and the button never touch when they wrap. */}
          <h2 id="close-title" className="flex flex-wrap items-center gap-x-[0.3em] gap-y-[0.3em] text-[clamp(2.25rem,6vw,5.75rem)] leading-[1.1]">
            <span>Start free as</span>
            <label htmlFor="close-email" className="sr-only">
              Your work email
            </label>
            <input
              id="close-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              // Text at half the headline size (sizes below are in the field's own em): the pill keeps the
              // headline's height while an address, and the placeholder, fit in full.
              className="h-[2.4em] w-[14em] min-w-0 max-w-full rounded-full bg-soot-3 px-[0.9em] text-[0.5em] text-white placeholder:text-mute focus:outline-2 focus:outline-offset-2 focus:outline-lime max-md:w-full"
            />
            <button
              type="submit"
              aria-label="Create a free account"
              className="group inline-flex h-[1.2em] cursor-pointer items-center gap-[0.15em] rounded-full bg-lime px-[0.5em] leading-none text-soot transition-[background-color,padding] duration-300 ease-[var(--ease-spring)] hover:bg-lime-deep hover:pr-[0.35em]"
            >
              today
              <span
                aria-hidden
                className="w-0 overflow-hidden text-[0.7em] opacity-0 transition-[width,opacity] duration-300 ease-[var(--ease-spring)] group-hover:w-[0.9em] group-hover:opacity-100 group-focus-visible:w-[0.9em] group-focus-visible:opacity-100"
              >
                →
              </span>
            </button>
          </h2>
          <div className="mt-8 flex flex-col gap-2 text-[1rem] text-mute sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
            <p>First site free, with real blocking and a 90-day consent log. No card needed.</p>
            <p>
              Prefer a walkthrough?{" "}
              <Link href="/contact?topic=sales" className="font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Book a demo
              </Link>
            </p>
          </div>
        </form>

        {/* Brand and contacts */}
        <div className="grid gap-8 border-t border-white/10 py-10 md:grid-cols-12 md:items-start">
          <div className="md:col-span-6">
            <Link href="/" aria-label="Plain Theory home" className="inline-flex items-center gap-2.5">
              <BrandMark size={28} variant="lime" />
              <span className="text-[1.125rem] font-semibold tracking-[-0.035em]">Plain Theory</span>
            </Link>
            <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-[1.55] text-white/75">
              Consent banner, cookie scanner, tracker blocking and a consent log you can prove, for GDPR, CCPA and the DPDP Act.
            </p>
          </div>
          <dl className="grid gap-5 sm:grid-cols-2 md:col-span-6">
            <div>
              <dt className={HEADING}>Sales and support</dt>
              <dd className="mt-2">
                <a href={`mailto:${site.email}`} className="mk-link text-[0.9375rem] text-white">
                  {site.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className={HEADING}>Privacy and grievances</dt>
              <dd className="mt-2">
                <a href={`mailto:${site.privacyEmail}`} className="mk-link text-[0.9375rem] text-white">
                  {site.privacyEmail}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Site map: six ruled columns on wide screens, two or three on smaller ones */}
        <nav aria-label="Footer" className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-3 xl:grid-cols-6 xl:divide-x xl:divide-white/10">
          {COLUMNS.map((col) => (
            <div key={col.label} className="py-8 pr-4 xl:px-6 xl:first:pl-0">
              <h3 className={HEADING}>{col.label}</h3>
              <ul className="mt-4">
                {col.links.map((l) => (
                  <li key={l.href + l.title}>
                    <Link href={l.href} className={LINK}>
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="py-8 pr-4 xl:px-6">
            <h3 className={HEADING}>Legal</h3>
            <ul className="mt-4">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>
                    {l.title}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton className={`${LINK} cursor-pointer`} />
              </li>
            </ul>
          </div>
        </nav>

        {/* Not legal advice: on every marketing page, in full in the terms (section "Not legal advice") */}
        <div className="grid gap-2 border-t border-white/10 py-6 md:grid-cols-12 md:gap-8">
          <p className={`${HEADING} md:col-span-2 md:pt-0.5`}>Disclaimer</p>
          <p className="max-w-[90ch] text-[0.875rem] leading-[1.6] text-mute md:col-span-10">
            Plain Theory is software, not legal advice, and using it does not by itself make a website compliant. For your own obligations, speak to a qualified
            lawyer.{" "}
            <Link href="/legal/terms#not-legal-advice" className="whitespace-nowrap text-white/85 underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
              Full disclaimer
            </Link>
          </p>
        </div>

        {/* Legal bar */}
        <div className="flex flex-col-reverse gap-4 border-t border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-mute">
            © {year} {site.legalName}. All rights reserved.
          </p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
