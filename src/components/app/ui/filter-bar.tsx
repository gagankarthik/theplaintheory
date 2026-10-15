import Link from "next/link";
import type { ReactNode } from "react";
import { IconClose } from "@/components/icons";
import { Button, buttonClass } from "./button";

/** An applied filter, shown as a removable chip; `href` is the same list without this filter. */
export interface FilterChip {
  /** what the chip says, e.g. "Decision: Accepted all" */
  label: string;
  /** the current URL less this one filter */
  href: string;
}

/**
 * Filters for a list, as a GET form: the URL holds the filters, so they survive a refresh, can be
 * shared, and work without JavaScript. Fields (SelectField, TextField, DateField, Checkbox) sit in
 * a responsive row; Apply submits, and "Clear filters" appears only while filters are active.
 *
 * With `chips`, the applied filters also show as a row of removable chips under the fields, ending
 * in "Clear all" (which then replaces "Clear filters" beside Apply).
 */
export function FilterBar({
  label,
  active,
  clearHref = "?",
  hidden,
  chips,
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
  /** applied filters as removable chips (optional) */
  chips?: FilterChip[];
  children: ReactNode;
  className?: string;
}) {
  const form = (
    <form method="get" role="search" aria-label={label} className={`flex flex-col gap-3 lg:flex-row lg:items-end ${chips ? "" : className}`}>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      <div className="grid min-w-0 flex-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">{children}</div>
      <div className="flex shrink-0 items-center gap-4 lg:h-10">
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
        {active && !chips ? (
          <Link href={clearHref} className={buttonClass("link")}>
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
  if (!chips) return form;
  return (
    <div className={className}>
      {form}
      {chips.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  aria-label={`Remove filter ${c.label}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface pl-2.5 pr-2 text-xs font-medium text-ink transition-colors duration-150 hover:border-boundary hover:bg-raised max-sm:h-11"
                >
                  {c.label}
                  <IconClose size={12} aria-hidden className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href={clearHref} className={`${buttonClass("link")} ml-1 text-xs`}>
            Clear all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
