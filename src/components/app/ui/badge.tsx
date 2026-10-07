import type { ReactNode } from "react";

/**
 * Semantic tones: success (jade), warning (amber), danger (rose), neutral and info (ink on paper).
 * Consent tones are aliases kept for existing callers: released = success, held = warning,
 * declined = danger. "brand" (ultramarine) marks the current item only, e.g. the current plan.
 */
export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info" | "brand" | "released" | "held" | "declined";

const SUCCESS = "bg-jade-wash text-jade";
const WARNING = "bg-amber-wash text-amber";
const DANGER = "bg-rose-wash text-rose";
const TONE: Record<BadgeTone, string> = {
  success: SUCCESS,
  warning: WARNING,
  danger: DANGER,
  released: SUCCESS,
  held: WARNING,
  declined: DANGER,
  neutral: "bg-paper text-ink-2 ring-1 ring-inset ring-line",
  info: "bg-surface text-ink ring-1 ring-inset ring-line-strong",
  brand: "bg-brand-wash text-brand-ink",
};
const DOT: Partial<Record<BadgeTone, string>> = {
  success: "bg-jade-bright",
  released: "bg-jade-bright",
  warning: "bg-amber-bright",
  held: "bg-amber-bright",
  danger: "bg-rose",
  declined: "bg-rose",
  info: "bg-ink-3",
  brand: "bg-brand",
};

/** Status pill. Meaning is always carried by the text; the colour and dot reinforce it. */
export function Badge({ tone = "neutral", children, icon, className = "" }: { tone?: BadgeTone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]} ${className}`}>
      {icon ?? (DOT[tone] ? <span className={`size-1.5 rounded-full ${DOT[tone]}`} aria-hidden /> : null)}
      {children}
    </span>
  );
}

export function PublishBadge({ dirty, published }: { dirty: boolean; published: boolean }) {
  if (!published) return <Badge tone="held">Not published</Badge>;
  if (dirty) return <Badge tone="held">Unpublished changes</Badge>;
  return <Badge tone="released">Live</Badge>;
}
