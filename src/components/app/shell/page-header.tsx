import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { LiveRefresh } from "./live-refresh";

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
  live,
}: {
  title: string;
  description?: React.ReactNode;
  crumbs?: { href?: string; label: string }[];
  actions?: React.ReactNode;
  /** Keep the page's data current while it's open: true for every 15 s, or an interval in ms */
  live?: boolean | number;
}) {
  const deep = (crumbs?.length ?? 0) > 3;
  return (
    <header className="relative mb-6 pt-7 sm:mb-8 sm:pt-9 print:mb-4 print:pt-0">
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
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">{title}</h1>
          {description ? <div className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-3">{description}</div> : null}
        </div>
        {actions || live ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {live ? <LiveRefresh interval={typeof live === "number" ? live : undefined} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
