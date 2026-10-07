import type { ReactNode } from "react";

/**
 * Data table for legal pages. Below 640px each row becomes a stacked card (first cell as the title,
 * the rest as label/value pairs) so no column is ever clipped; from 640px it is a real table that
 * scrolls sideways inside its own focusable frame if it must. The caption names both for screen readers.
 */
export function LegalTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <>
      {/* stacked rows for small screens; divs with list roles so the prose list styles don't apply */}
      <div role="list" aria-label={caption} className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line text-[0.9375rem] leading-normal sm:hidden">
        {rows.map((row, i) => (
          <div role="listitem" key={i} className="px-4 py-4">
            <div className="font-medium text-ink">{row[0]}</div>
            <dl className="mt-3 space-y-3">
              {row.slice(1).map((cell, j) => (
                <div key={j}>
                  <dt className="text-xs font-semibold text-ink-3">{head[j + 1]}</dt>
                  <dd className="mt-0.5 [overflow-wrap:anywhere]">{cell}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-line sm:block" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full min-w-[34rem] border-collapse text-left text-[0.9375rem] leading-normal">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-paper">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-line last:border-b-0">
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-4 py-3 align-top font-medium text-ink">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="px-4 py-3 align-top">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
