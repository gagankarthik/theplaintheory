import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

/**
 * Page heading band: the page's single h1, description and actions, on a full-width white band
 * above the grey content area. Breadcrumbs are only shown for pages below tab level, since the
 * top bar already shows organization and site.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  crumbs?: { href?: string; label: string }[];
  actions?: React.ReactNode;
}) {
  const deep = (crumbs?.length ?? 0) > 3;
  return (
    <header className="relative mb-8 py-8 before:absolute before:inset-y-0 before:left-1/2 before:-z-0 before:w-screen before:-translate-x-1/2 before:border-b before:border-line before:bg-surface sm:py-10 print:mb-4 print:py-0 print:before:hidden">
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {deep && crumbs ? (
            <nav aria-label="Breadcrumb" className="mb-2">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
                {crumbs.slice(1).map((c, i, list) => (
                  <li key={i} className="flex items-center gap-1">
                    {c.href ? (
                      <Link href={c.href} className="inline-flex min-h-6 items-center rounded hover:text-ink">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current="page">{c.label}</span>
                    )}
                    {i < list.length - 1 ? <IconChevronRight size={12} /> : null}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2rem]">{title}</h1>
          {description ? <div className="mt-1.5 max-w-[68ch] text-[15px] text-ink-3">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
