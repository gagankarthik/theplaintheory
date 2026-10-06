import type { ReactNode } from "react";

/**
 * Data table for legal pages. Scrolls sideways inside its own frame on narrow screens so the page
 * never does; the caption names the table for screen readers.
 */
export function LegalTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label={caption}>
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
  );
}
