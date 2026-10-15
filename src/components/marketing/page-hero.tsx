import Link from "next/link";
import type { ReactNode } from "react";
import { absoluteUrl } from "@/lib/site";
import { JsonLd } from "./json-ld";

export interface Crumb {
  name: string;
  href: string;
}

/** Visible breadcrumb trail plus BreadcrumbList structured data. The last crumb is the current page. */
export function Breadcrumbs({ items, tone = "light" }: { items: Crumb[]; tone?: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-mute" : "text-mute-ink";
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className={`flex flex-wrap items-center gap-1.5 text-[0.9375rem] ${muted}`}>
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${i}-${c.name}`} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className={tone === "dark" ? "text-white" : "text-soot"}>
                    {c.name}
                  </span>
                ) : (
                  <>
                    <Link href={c.href} className="mk-link">
                      {c.name}
                    </Link>
                    <span aria-hidden>/</span>
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
 * Page header for secondary pages, on the marketing site's soot (ink, brand) or chalk (paper) ground.
 * Left-aligned title, lead and actions; an optional figure sits on the right from large screens.
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
  const dark = tone !== "paper";
  return (
    <section aria-labelledby="page-title" className={dark ? "bg-soot text-white" : "on-light bg-chalk text-soot"}>
      <div className={`mx-auto grid max-w-[1440px] gap-10 px-5 pb-14 pt-10 sm:px-8 md:pb-16 ${figure ? "lg:grid-cols-12 lg:items-end" : ""}`}>
        <div className={`mk-fade ${figure ? "lg:col-span-7" : ""}`}>
          {crumbs ? <Breadcrumbs items={crumbs} tone={dark ? "dark" : "light"} /> : null}
          <h1 id="page-title" className={`max-w-[18ch] text-[clamp(2.25rem,4.2vw,3.75rem)] ${crumbs ? "mt-6" : ""}`}>
            {title}
          </h1>
          {lead ? <div className="mt-5 max-w-[60ch] text-[1.125rem] leading-[1.55]">{lead}</div> : null}
          {meta ? <div className={`mt-4 text-[0.9375rem] ${dark ? "text-mute" : "text-mute-ink"}`}>{meta}</div> : null}
          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        </div>
        {figure ? <div className="lg:col-span-5">{figure}</div> : null}
      </div>
    </section>
  );
}
