/**
 * Determinate progress bar (role="progressbar"). With no `value` it is indeterminate: a travelling
 * sheen. Tone colours the fill only; the accessible name and value text carry the meaning.
 */
export function Progress({
  value,
  max = 100,
  label,
  valueText,
  tone = "brand",
  size = "md",
  className = "",
}: {
  value?: number;
  max?: number;
  label: string;
  /** e.g. "12 of 40 pages" */
  valueText?: string;
  tone?: "brand" | "ok" | "warn" | "bad";
  size?: "sm" | "md";
  className?: string;
}) {
  const fill = { brand: "bg-interactive", ok: "bg-jade-bright", warn: "bg-amber-bright", bad: "bg-rose" }[tone];
  const pct = value === undefined ? null : Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={`relative w-full overflow-hidden rounded-full bg-line-strong/60 ${size === "sm" ? "h-1" : "h-2"} ${className}`}
    >
      {pct === null ? (
        <span className="skeleton absolute inset-0 !rounded-full !bg-[length:40%_100%] opacity-80" />
      ) : (
        <span className={`absolute inset-y-0 left-0 rounded-full ${fill} transition-[width] duration-300 ease-out`} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}
