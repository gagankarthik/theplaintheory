import Link from "next/link";
import type { ReactNode } from "react";
import { absoluteUrl } from "@/lib/site";
import { JsonLd } from "./json-ld";
import { Lattice } from "./lattice";

export interface Crumb {
  name: string;
  href: string;
}

/** Visible breadcrumb trail plus BreadcrumbList structured data. The last crumb is the current page. */
export function Breadcrumbs({ items, tone = "light" }: { items: Crumb[]; tone?: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-white/60 hover:text-white" : "text-ink-3 hover:text-ink";
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${i}-${c.name}`} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className={tone === "dark" ? "text-white" : "text-ink"}>
                    {c.name}
                  </span>
                ) : (
                  <>
                    <Link href={c.href} className={`transition-colors ${muted}`}>
                      {c.name}
                    </Link>
                    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden className={tone === "dark" ? "text-white/40" : "text-ink-3"}>
                      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.href) })),
        }}
      />
    </>
  );
}

/**
 * Page header for secondary pages.
 *   brand: ultramarine band with the lattice, centred (pricing).
 *   paper: quiet left-aligned header with breadcrumb (compliance, docs, legal).
 *   ink:   dark band, left-aligned, with an optional figure on the right (security).
 */
export function PageHero({
  tone,
  title,
  lead,
  crumbs,
  meta,
  figure,
  children,
}: {
  tone: "brand" | "paper" | "ink";
  title: ReactNode;
  lead?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode;
  figure?: ReactNode;
  children?: ReactNode;
}) {
  if (tone === "brand") {
    return (
      <section aria-labelledby="page-title" className="relative overflow-hidden bg-[linear-gradient(180deg,#2e2bd6_0%,#211eb0_70%,#1a178f_100%)] text-white">
        <Lattice className="absolute inset-0 h-full w-full" />
        <div className="container-page relative py-20 text-center md:py-28">
          <h1 id="page-title" className="display mx-auto max-w-[880px] text-[2.5rem] sm:text-6xl md:text-[4rem]">
            {title}
          </h1>
          {lead ? <p className="mx-auto mt-6 max-w-[600px] text-lg text-white/80 md:text-xl">{lead}</p> : null}
          {children ? <div className="mt-9 flex flex-wrap justify-center gap-3">{children}</div> : null}
        </div>
      </section>
    );
  }

  const dark = tone === "ink";
  return (
    <section aria-labelledby="page-title" className={dark ? "bg-ink text-white" : "border-b border-line bg-paper"}>
      <div className={`container-page grid gap-12 py-14 md:py-20 ${figure ? "lg:grid-cols-12 lg:items-center" : ""}`}>
        <div className={figure ? "lg:col-span-7" : ""}>
          {crumbs ? <Breadcrumbs items={crumbs} tone={dark ? "dark" : "light"} /> : null}
          <h1 id="page-title" className={`display max-w-[860px] text-[2.5rem] sm:text-5xl md:text-[3.5rem] ${crumbs ? "mt-6" : ""}`}>
            {title}
          </h1>
          {lead ? <p className={`mt-6 max-w-[640px] text-lg md:text-xl ${dark ? "text-white/75" : "text-ink-2"}`}>{lead}</p> : null}
          {meta ? <div className={`mt-6 text-sm ${dark ? "text-white/60" : "text-ink-3"}`}>{meta}</div> : null}
          {children ? <div className="mt-9 flex flex-wrap gap-3">{children}</div> : null}
        </div>
        {figure ? <div className="lg:col-span-5">{figure}</div> : null}
      </div>
    </section>
  );
}
