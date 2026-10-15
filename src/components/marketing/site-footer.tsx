import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { site } from "@/lib/site";
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

const BOTTOM_LINK = "inline-flex min-h-11 items-center text-[0.9375rem] text-mute transition-colors hover:text-white sm:min-h-0";

/** The close of every marketing page: the mark and a one-line description, the site map, the disclaimer and the legal row. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer aria-labelledby="footer-title" className="bg-soot text-white">
      <h2 id="footer-title" className="sr-only">
        Site footer
      </h2>
      <div className="mx-auto max-w-[1440px] px-5 pt-14 sm:px-8 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-3">
            <Link href="/" aria-label="Plain Theory home" className="inline-flex items-center gap-2.5">
              <BrandMark size={28} variant="lime" />
              <span className="text-[1.125rem] font-semibold tracking-[-0.035em]">Plain Theory</span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-[1rem] leading-[1.55] text-white/85">
              Consent banner, cookie scanner and consent records for GDPR, CCPA and India’s DPDP Act.
            </p>
            <ul className="mt-5 space-y-1 text-[0.9375rem]">
              <li>
                <a href={`mailto:${site.email}`} className="mk-link text-white">
                  {site.email}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.privacyEmail}`} className="mk-link text-white">
                  {site.privacyEmail}
                </a>
                <span className="block text-mute">Privacy and DPDP grievances</span>
              </li>
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:col-span-9 lg:grid-cols-5">
            {COLUMNS.map((col) => (
              <div key={col.label}>
                <h3 className="text-[0.9375rem] font-medium text-mute">{col.label}</h3>
                <ul className="mt-3">
                  {col.links.map((l) => (
                    <li key={l.href + l.title}>
                      <Link href={l.href} className="inline-flex min-h-11 items-center text-[0.9375rem] text-white/90 transition-colors hover:text-white sm:min-h-9">
                        {l.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Not legal advice: shown on every marketing page, mirrored in the terms (section "Not legal advice") */}
        <p className="mt-12 max-w-[90ch] text-[0.9375rem] leading-relaxed text-mute">
          Plain Theory provides software, not legal services. Nothing on this website or in our product, documentation, guides, templates, emails or support
          conversations is legal or regulatory advice, and using Plain Theory does not by itself make your website compliant with any law. For advice on your
          obligations under GDPR, CCPA/CPRA, the DPDP Act or any other law, consult a qualified lawyer.{" "}
          <Link href="/legal/terms#not-legal-advice" className="text-white underline underline-offset-2">
            Read the full disclaimer
          </Link>
          .
        </p>

        <div className="mt-8 flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-[0.9375rem] text-mute">
            © {year} {site.legalName}
          </p>
          <ul className="flex flex-wrap items-center gap-x-6">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={BOTTOM_LINK}>
                  {l.title}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton className={`${BOTTOM_LINK} cursor-pointer`} />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
