import type { ReactNode } from "react";
import { PageHero } from "../page-hero";
import { Prose } from "../prose";
import { Toc, type TocItem } from "../toc";

/** Long-form legal document: quiet header, sticky contents on desktop, 68ch prose column. */
export function LegalPage({
  title,
  path,
  updated,
  toc,
  children,
}: {
  title: string;
  path: string;
  updated: { iso: string; label: string };
  toc: TocItem[];
  children: ReactNode;
}) {
  return (
    <>
      <PageHero
        tone="paper"
        crumbs={[
          { name: "Home", href: "/" },
          { name: title, href: path },
        ]}
        title={title}
        meta={
          <>
            Last updated <time dateTime={updated.iso}>{updated.label}</time>
          </>
        }
      />
      <div className="bg-surface">
        <div className="container-page grid gap-12 py-16 md:py-20 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-28">
              <Toc items={toc} label="Contents" />
            </div>
          </aside>
          <article className="min-w-0 lg:col-span-9 lg:pl-8">
            <Prose>{children}</Prose>
          </article>
        </div>
      </div>
    </>
  );
}
