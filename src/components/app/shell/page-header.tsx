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
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  crumbs?: { href?: string; label: string }[];
  actions?: React.ReactNode;
  /** Keep the page's data current while it's open: true for every 15 s, or an interval in ms */
  live?: boolean | number;
  /** small label above the title, e.g. the section group ("Configure") or a status */
  eyebrow?: React.ReactNode;
}) {
  const deep = (crumbs?.length ?? 0) > 3;
  return (
    <header className="relative mb-6 pt-6 sm:mb-7 sm:pt-8 print:mb-4 print:pt-0">
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
          {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[1.625rem]">{title}</h1>
          {description ? <div className="mt-1.5 max-w-[64ch] text-sm leading-relaxed text-ink-3">{description}</div> : null}
        </div>
        {actions || live ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {live ? <LiveRefresh interval={typeof live === "number" ? live : undefined} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
