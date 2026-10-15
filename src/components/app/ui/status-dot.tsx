/**
 * A small state light. `pulse` adds a soft expanding ring for live or in-progress states (skipped
 * for reduced motion). Meaning is carried by `label` (visible or screen-reader only), never colour.
 * Server-safe: the animation is pure CSS.
 */
export type DotTone = "live" | "ok" | "warn" | "bad" | "idle" | "brand";

const FILL: Record<DotTone, string> = {
  live: "bg-jade-bright",
  ok: "bg-jade-bright",
  warn: "bg-amber-bright",
  bad: "bg-rose",
  idle: "bg-ink-3/60",
  brand: "bg-brand",
};

export function StatusDot({ tone = "ok", pulse, label, showLabel, size = 8, className = "" }: { tone?: DotTone; pulse?: boolean; label: string; showLabel?: boolean; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        {pulse ? <span className={`absolute inset-0 animate-pulse-ring rounded-full ${FILL[tone]}`} /> : null}
        <span className={`relative rounded-full ${FILL[tone]}`} style={{ width: size, height: size }} />
      </span>
      <span className={showLabel ? "text-xs text-ink-2" : "sr-only"}>{label}</span>
    </span>
  );
}
