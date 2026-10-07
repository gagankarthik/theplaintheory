import type { ReactNode } from "react";

export interface DescriptionItem {
  label: string;
  value: ReactNode;
}

/**
 * Label/value facts.
 *
 *   layout="grid"     label above value, items flowing in 2–4 columns (summary facts on a card)
 *   layout="stacked"  one item per row, label on the left in a fixed 11rem column (details pages);
 *                     the label moves above the value on phones
 *
 * An empty value shows a quiet "None" so a row never looks broken.
 */
export function DescriptionList({ items, layout = "grid", columns = 3, className = "" }: { items: DescriptionItem[]; layout?: "grid" | "stacked"; columns?: 2 | 3 | 4; className?: string }) {
  const value = (v: ReactNode) => (v === null || v === undefined || v === "" ? <span className="text-ink-3">None</span> : v);
  if (layout === "stacked") {
    return (
      <dl className={`divide-y divide-line text-sm ${className}`}>
        {items.map((i) => (
          <div key={i.label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-ink-3">{i.label}</dt>
            <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{value(i.value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const cols = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <dl className={`grid gap-x-6 gap-y-4 ${cols} ${className}`}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-ink-3">{i.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">{value(i.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
