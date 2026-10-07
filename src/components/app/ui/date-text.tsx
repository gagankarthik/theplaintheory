import { formatDate, formatDateTime, formatDateTimeFull, formatRelative, toDate, type DateInput } from "@/lib/format";

/**
 * A date on screen: <time> with the machine-readable value, the text in the chosen form and the
 * full UTC time as its title, so a hover always answers "exactly when?". Server-safe.
 *
 *   mode="date"      7 Oct 2026
 *   mode="datetime"  7 Oct 2026, 14:05 UTC
 *   mode="relative"  3 hours ago
 */
export function DateText({ iso, mode = "date", className }: { iso: DateInput; mode?: "date" | "datetime" | "relative"; className?: string }) {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return <span className={className}>—</span>;
  const text = mode === "relative" ? formatRelative(d) : mode === "datetime" ? formatDateTime(d) : formatDate(d);
  return (
    // relative text depends on "now", which differs between the server render and hydration
    <time dateTime={d.toISOString()} title={formatDateTimeFull(d)} className={className} suppressHydrationWarning={mode === "relative" || undefined}>
      {text}
    </time>
  );
}
