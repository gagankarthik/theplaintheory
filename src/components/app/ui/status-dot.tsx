/**
 * A small state light. Meaning is carried by `label` (visible or screen-reader only), and the shape
 * is a second channel next to the colour: filled for ok/live, a ring for warn, a diamond for bad,
 * hollow for idle. `pulse` adds a soft expanding ring for live or in-progress states (skipped for
 * reduced motion). Server-safe: the animation is pure CSS.
 */
export type DotTone = "live" | "ok" | "warn" | "bad" | "idle" | "brand";

const FILL: Record<DotTone, string> = {
  live: "bg-jade-bright",
  ok: "bg-jade-bright",
  warn: "bg-amber-bright",
  bad: "bg-rose",
  idle: "bg-ink-3/60",
  brand: "bg-marker",
};

const SHAPE: Record<DotTone, string> = {
  live: "rounded-full",
  ok: "rounded-full",
  brand: "rounded-full",
  // a ring: the fill colour as a thick border around a surface centre
  warn: "rounded-full !bg-transparent border-2 border-amber-bright",
  bad: "rotate-45 scale-90 rounded-[1px]",
  idle: "rounded-full !bg-transparent border-[1.5px] border-ink-3",
};

export function StatusDot({ tone = "ok", pulse, label, showLabel, size = 8, className = "" }: { tone?: DotTone; pulse?: boolean; label: string; showLabel?: boolean; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        {pulse ? <span className={`absolute inset-0 animate-pulse-ring rounded-full ${FILL[tone]}`} /> : null}
        <span className={`relative ${FILL[tone]} ${SHAPE[tone]}`} style={{ width: size, height: size }} />
      </span>
      <span className={showLabel ? "text-xs text-ink-2" : "sr-only"}>{label}</span>
    </span>
  );
}
