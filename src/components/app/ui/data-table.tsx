"use client";

import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
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
 * header cells, numeric columns right-aligned with tabular figures. Below 640px each row becomes a
 * stacked item: the first column is the title and the rest are label/value pairs.
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
}) {
  const [sort, setSort] = useState(initialSort);
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

  const toggle = (id: string) =>
    setSort((s) => (s?.id === id ? { id, dir: s.dir === "ascending" ? "descending" : "ascending" } : { id, dir: "descending" }));

  return (
    <div className="panel overflow-hidden">
      {/* stacked rows for small screens */}
      <ul className="divide-y divide-line sm:hidden" aria-label={caption}>
        {sorted.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-3">{empty ?? "Nothing to show."}</li>
        ) : (
          sorted.map((row) => {
            const [first, ...rest] = columns;
            return (
              <li key={rowKey(row)} className={`relative px-4 py-3.5 ${rowClassName?.(row) ?? ""}`}>
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
      <div className="hidden overflow-x-auto sm:block" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <caption className={captionHidden ? "sr-only" : "px-5 pt-4 text-left text-base font-semibold"}>{caption}</caption>
          <thead className="border-b border-line bg-paper/60 text-xs text-ink-3">
            <tr>
              {columns.map((c) => {
                const active = sort?.id === c.id;
                const right = c.align === "right";
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={c.sortValue ? (active ? sort!.dir : "none") : undefined}
                    className={`px-4 py-3 font-medium first:pl-5 last:pr-5 ${right ? "text-right" : ""}`}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`-mx-1.5 inline-flex min-h-6 items-center gap-1 rounded px-1.5 hover:bg-line hover:text-ink ${active ? "text-ink" : ""} ${right ? "flex-row-reverse" : ""}`}
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
              sorted.map((row) => (
                <tr key={rowKey(row)} className={`group transition-colors hover:bg-paper ${rowClassName?.(row) ?? ""}`}>
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={`px-4 py-3 align-middle first:pl-5 last:pr-5 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-line px-5 py-3 text-xs text-ink-3">{footer}</div> : null}
    </div>
  );
}
