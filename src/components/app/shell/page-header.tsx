import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { LiveRefresh } from "./live-refresh";

/**
 * Page heading band: breadcrumbs, the page's single h1, its description and actions. Breadcrumbs come
 * from the shell (organization / site / section) on every page; pass `crumbs` only to name a page
 * below its section (the last crumb is used as the leaf) or to keep a filtered link back.
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
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  /** Keep the page's data current while it's open: true for every 15 s, or an interval in ms */
  live?: boolean | number;
  /** small label above the title, e.g. the section group ("Configure") or a status */
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="relative mb-6 pt-5 sm:mb-8 sm:pt-7 print:mb-4 print:pt-0">
      <div className="print:hidden">
        <Breadcrumbs crumbs={crumbs} title={title} />
      </div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
          <h1 className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{title}</h1>
          {description ? <div className="mt-2 max-w-[64ch] text-sm text-ink-3">{description}</div> : null}
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
