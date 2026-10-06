import Link from "next/link";
import { Logo } from "@/components/icons";
import { site } from "@/lib/site";
import { CookieSettingsButton } from "./cookie-settings-button";
import { FOOTER_NAV, LEGAL_NAV } from "./nav-data";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-paper text-ink" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">
        Site footer
      </h2>

      <div className="container-page pt-20 lg:pt-24">
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5"
        >
          {FOOTER_NAV.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
              <ul className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      className="link-draw text-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h3 className="text-sm font-semibold text-ink">Legal</h3>
            <ul className="mt-5 space-y-3">
              {LEGAL_NAV.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="link-draw text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton className="link-draw text-sm text-ink-2 transition-colors hover:text-ink" />
              </li>
            </ul>
          </div>
        </nav>

        {/* A rule above the logo */}
        <div className="mt-16 border-t border-line pt-10">
          <Link
            href="/"
            aria-label="Plain Theory home"
            className="inline-flex rounded-md"
          >
            <Logo size={18} />
          </Link>
        </div>

        {/* Not legal advice: shown on every marketing page, mirrored in the terms (section "Not legal advice") */}
        <p className="mt-6 max-w-[110ch] text-xs leading-relaxed text-ink-3">
          Plain Theory provides software, not legal services. Nothing on this
          website or in our product, documentation, guides, templates, emails or
          support conversations is legal or regulatory advice, and using Plain
          Theory does not by itself make your website compliant with any law.
          For advice on your obligations under GDPR, CCPA/CPRA, the DPDP Act or
          any other law, consult a qualified lawyer.{" "}
          <Link
            href="/legal/terms#not-legal-advice"
            className="underline underline-offset-2 transition-colors hover:text-ink"
          >
            Read the full disclaimer
          </Link>
          .
        </p>

        <p className="mt-6 pb-10 text-[13px] text-ink-2">
          © {year} {site.legalName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
