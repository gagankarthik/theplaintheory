import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonClass } from "./button";

/**
 * Filters for a list, as a GET form: the URL holds the filters, so they survive a refresh, can be
 * shared, and work without JavaScript. Fields (SelectField, TextField, DateField, Checkbox) sit in
 * a responsive row; Apply submits, and "Clear filters" appears only while filters are active.
 */
export function FilterBar({
  label,
  active,
  clearHref = "?",
  hidden,
  children,
  className = "mb-4",
}: {
  /** accessible name of the search region, e.g. "Filter consent receipts" */
  label: string;
  /** whether any filter is applied */
  active: boolean;
  /** where "Clear filters" goes; defaults to the page with no query */
  clearHref?: string;
  /** params to keep across submits, e.g. a selected range */
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form method="get" role="search" aria-label={label} className={`flex flex-col gap-3 lg:flex-row lg:items-end ${className}`}>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      <div className="grid min-w-0 flex-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">{children}</div>
      <div className="flex shrink-0 items-center gap-4 lg:h-10">
        <Button type="submit" variant="ghost" size="sm">
          Apply
        </Button>
        {active ? (
          <Link href={clearHref} className={buttonClass("link")}>
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
