"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionTab {
  href: string;
  label: string;
}

/**
 * The pages of one sidebar item (Trackers & catalog, Banner studio, Consent vault), as a row of links
 * above the page heading. Navigation, not an ARIA tablist: each is its own URL, and the current one
 * is marked with aria-current and an underline. A page below a tab (a receipt) keeps its tab current.
 */
export function SectionNav({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const pathname = usePathname();
  const current = tabs.filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-line px-4 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:hidden">
      <ul className="flex gap-6">
        {tabs.map((t) => {
          const on = t === current;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center whitespace-nowrap text-sm transition-colors ${
                  on ? "font-semibold text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
