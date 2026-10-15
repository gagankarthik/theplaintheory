"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

export interface Crumb {
  href?: string;
  label: string;
}

/**
 * Turns a path into the trail above it: the shell knows the organization, the sites and the nav
 * sections, so every page gets the same breadcrumbs without building them. The last crumb returned
 * is the section the path is in; deeper pages add their own leaf.
 */
export type TrailResolver = (pathname: string) => Crumb[];

const TrailContext = createContext<TrailResolver | null>(null);

export function BreadcrumbProvider({ resolve, children }: { resolve: TrailResolver; children: ReactNode }) {
  return <TrailContext.Provider value={resolve}>{children}</TrailContext.Provider>;
}

/**
 * Breadcrumbs for the page header. Inside a shell the trail comes from the path (organization, site,
 * section); a page below its section adds a leaf: the last of its own `crumbs`, else its `title`.
 * Section links reuse the page's own href when it passes one with the same label (e.g. a filtered log).
 * Outside a shell, the page's `crumbs` are shown as given.
 */
export function Breadcrumbs({ crumbs, title }: { crumbs?: Crumb[]; title: string }) {
  const resolve = useContext(TrailContext);
  const pathname = usePathname();

  let trail: Crumb[];
  if (resolve) {
    const base = resolve(pathname);
    const section = base[base.length - 1];
    const below = section?.href && pathname !== section.href;
    trail = base.map((c) => ({ ...c, href: crumbs?.find((x) => x.label === c.label && x.href)?.href ?? c.href }));
    if (below) trail.push({ label: crumbs?.[crumbs.length - 1]?.label ?? title });
    else if (section) trail[trail.length - 1] = { label: section.label };
  } else {
    trail = crumbs ?? [];
  }
  if (trail.length < 2) return null;

  const parent = [...trail].reverse().find((c, i) => i > 0 && c.href);
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      {/* phones: just the way back up */}
      {parent?.href ? (
        <Link href={parent.href} className="-ml-1 inline-flex min-h-10 items-center gap-1 rounded-full px-1 text-sm text-ink-3 transition-colors duration-150 hover:text-ink sm:hidden">
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
          {parent.label}
        </Link>
      ) : null}
      <ol className="hidden min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-3 sm:flex">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1.5">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={`max-w-[22ch] truncate ${last ? "font-medium text-ink" : ""}`}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="max-w-[22ch] truncate rounded-sm transition-colors duration-150 hover:text-ink hover:underline hover:underline-offset-4">
                  {c.label}
                </Link>
              )}
              {last ? null : (
                <span aria-hidden className="text-line-input">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
