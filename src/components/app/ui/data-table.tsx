"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buttonClass } from "./button";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** numeric column: right-aligned with tabular figures (the same as align "right") */
  numeric?: boolean;
  /** providing a sort value makes the column sortable */
  sortValue?: (row: T) => string | number;
  /** leave out of the stacked mobile layout */
  hideOnMobile?: boolean;
  /** plain-text label used in the stacked mobile layout when `header` isn't a string */
  mobileLabel?: string;
  className?: string;
}

type Dir = "ascending" | "descending";

/**
 * Accessible data table: <caption>, scope="col", aria-sort on sortable headers, sort buttons in the
 * header cells, numeric columns right-aligned with tabular figures. Rows highlight on hover; a
 * selected row (`isSelected`) gets the lime wash plus a marker bar and aria-selected. With
 * `maxHeight` the table scrolls inside its card and the header row stays put. Below 640px each row
 * becomes a stacked item: the first column is the title and the rest are label/value pairs.
 */
export function DataTable<T>({
  rows,
  columns,
  caption,
  captionHidden = true,
  rowKey,
  initialSort,
  empty,
  footer,
  minWidth = 640,
  rowClassName,
  isSelected,
  maxHeight,
  pageSize,
  noun,
}: {
  rows: T[];
  columns: Column<T>[];
  caption: string;
  captionHidden?: boolean;
  rowKey: (row: T) => string;
  initialSort?: { id: string; dir: Dir };
  empty?: ReactNode;
  footer?: ReactNode;
  minWidth?: number;
  rowClassName?: (row: T) => string;
  /** marks selected rows (lime wash, marker bar, aria-selected) */
  isSelected?: (row: T) => boolean;
  /** scroll the rows inside the card with a sticky header, e.g. 480 or "60dvh" */
  maxHeight?: number | string;
  /**
   * Show this many rows at a time (after sorting) with Previous / Next below the table. Sorting or
   * new `rows` (e.g. a changed filter) go back to the first page. Leave out to show every row.
   */
  pageSize?: number;
  /** what the rows are, for the pager's "Showing 1–50 of 230 organizations"; defaults to "rows" */
  noun?: [singular: string, plural: string];
}) {
  const right = (c: Column<T>) => c.align === "right" || c.numeric;
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  // new rows (a filter changed) start again on the first page
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setPage(0);
  }
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort?.id);
    if (!col?.sortValue || !sort) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "ascending" ? r : -r;
    });
  }, [rows, columns, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  const toggle = (id: string) => {
    setPage(0);
    setSort((s) => (s?.id === id ? { id, dir: s.dir === "ascending" ? "descending" : "ascending" } : { id, dir: "descending" }));
  };

  return (
    <div className="panel overflow-hidden">
      {/* stacked rows for small screens */}
      <ul className="divide-y divide-line sm:hidden" aria-label={caption}>
        {sorted.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-3">{empty ?? "Nothing to show."}</li>
        ) : (
          visible.map((row) => {
            const [first, ...rest] = columns;
            return (
              <li key={rowKey(row)} aria-current={isSelected?.(row) || undefined} className={`relative px-4 py-3.5 ${isSelected?.(row) ? "bg-selected/45 shadow-[inset_3px_0_0_var(--color-marker)] dark:bg-selected" : ""} ${rowClassName?.(row) ?? ""}`}>
                <div className="mb-2 text-sm">{first.cell(row)}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {rest
                    .filter((c) => !c.hideOnMobile)
                    .map((c) => (
                      <div key={c.id} className="contents">
                        <dt className="text-xs leading-5 text-ink-3">{c.mobileLabel ?? c.header}</dt>
                        <dd className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]">{c.cell(row)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            );
          })
        )}
      </ul>
      <div className="scroll-thin hidden overflow-x-auto sm:block" tabIndex={0} role="region" aria-label={caption} style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <caption className={captionHidden ? "sr-only" : "px-5 pt-4 text-left text-base font-semibold"}>{caption}</caption>
          <thead className="sticky top-0 z-10 bg-raised text-xs text-ink-3 shadow-[inset_0_-1px_0_var(--color-line)]">
            <tr>
              {columns.map((c) => {
                const active = sort?.id === c.id;
                const end = right(c);
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={c.sortValue ? (active ? sort!.dir : "none") : undefined}
                    className={`h-10 px-4 font-medium first:pl-5 last:pr-5 ${end ? "text-right" : ""}`}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`-mx-1.5 inline-flex min-h-7 items-center gap-1 rounded-sm px-1.5 transition-colors duration-150 hover:bg-line hover:text-ink ${active ? "text-ink" : ""} ${end ? "flex-row-reverse" : ""}`}
                      >
                        {c.header}
                        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden className="shrink-0">
                          <path d="M5 1L8.5 5h-7z" fill="currentColor" opacity={active && sort!.dir === "ascending" ? 1 : 0.3} />
                          <path d="M5 11L1.5 7h7z" fill="currentColor" opacity={active && sort!.dir === "descending" ? 1 : 0.3} />
                        </svg>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-ink-3">
                  {empty ?? "Nothing to show."}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const sel = isSelected?.(row);
                return (
                  <tr
                    key={rowKey(row)}
                    aria-selected={isSelected ? Boolean(sel) : undefined}
                    className={`group transition-colors duration-150 ${sel ? "bg-selected/45 dark:bg-selected" : "hover:bg-raised"} ${rowClassName?.(row) ?? ""}`}
                  >
                    {columns.map((c, i) => (
                      <td
                        key={c.id}
                        className={`px-4 py-3 align-middle first:pl-5 last:pr-5 ${right(c) ? "text-right tabular-nums" : ""} ${sel && i === 0 ? "shadow-[inset_3px_0_0_var(--color-marker)]" : ""} ${c.className ?? ""}`}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pageSize && sorted.length > pageSize ? (
        <nav aria-label={`${caption}, pages`} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p aria-live="polite" className="text-xs tabular-nums text-ink-3">
            Showing {(current * pageSize + 1).toLocaleString("en-GB")}–{Math.min((current + 1) * pageSize, sorted.length).toLocaleString("en-GB")} of {sorted.length.toLocaleString("en-GB")}{" "}
            {noun ? noun[1] : "rows"}
          </p>
          <div className="flex gap-2">
            <button type="button" className={buttonClass("secondary", "sm")} disabled={current === 0} onClick={() => setPage(current - 1)}>
              <span aria-hidden>←</span> Previous
            </button>
            <button type="button" className={buttonClass("secondary", "sm")} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </nav>
      ) : null}
      {footer ? <div className="border-t border-line px-5 py-3 text-xs text-ink-3">{footer}</div> : null}
    </div>
  );
}
