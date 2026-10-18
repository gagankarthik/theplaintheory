import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
/** One step above this page: `href` makes it the back link. */
export interface Crumb {
  href?: string;
  label: string;
}
import { LiveRefresh } from "./live-refresh";

/**
 * Page heading band: the page's single h1, its description and actions. No breadcrumb trail: the
 * sidebar and the site switcher already say where you are. A page one level below a list (a receipt,
 * a user) passes `crumbs`, and gets one "back" link to the nearest crumb that has a link.
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
      {(() => {
        const back = crumbs?.slice(0, -1).filter((c) => c.href).at(-1);
        return back?.href ? (
          <Link href={back.href} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink print:hidden sm:min-h-0">
            <IconArrowRight size={14} aria-hidden className="rotate-180" />
            {back.label}
          </Link>
        ) : null;
      })()}
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
