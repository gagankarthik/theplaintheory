import Link from "next/link";

export interface Stat {
  label: string;
  value: string;
  /** one short line of context: the denominator, the period, or what the number means */
  note?: React.ReactNode;
  /**
   * Colour carries meaning only. "bad" is rose (failing, over the limit, a leak), "warn" is amber
   * (needs review), "good" is jade (a consent state that's healthy). Default is ink.
   */
  tone?: "bad" | "warn" | "good";
  /** where the number comes from: the tile becomes a link to the list behind it */
  href?: string;
}

const toneClass = { bad: "text-rose", warn: "text-amber", good: "text-jade" } as const;

/**
 * The page's numbers at a glance: one divided row, 2 columns on phones and up to 4 on desktop.
 * Every page opens with the 2–4 numbers that answer "is this part of my setup OK?", so people
 * can scan a page's state before reading its controls.
 */
export function StatStrip({ stats, label, className = "mb-6" }: { stats: Stat[]; label: string; className?: string }) {
  const cols = stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <ul aria-label={label} className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line ${cols} ${className}`}>
      {stats.map((t) => {
        const body = (
          <>
            <span className="block text-sm text-ink-3 group-hover:text-ink-2">{t.label}</span>
            <span className={`mt-1 block break-words text-2xl font-semibold tabular-nums tracking-tight ${t.tone ? toneClass[t.tone] : "text-ink"}`}>{t.value}</span>
            {t.note ? <span className="mt-0.5 block text-xs text-ink-3">{t.note}</span> : null}
          </>
        );
        return (
          <li key={t.label} className={`bg-surface ${stats.length === 3 ? "max-sm:last:col-span-2" : ""}`}>
            {t.href ? (
              <Link href={t.href} className="group block h-full px-5 py-4 transition-colors hover:bg-paper">
                {body}
              </Link>
            ) : (
              <div className="h-full px-5 py-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
