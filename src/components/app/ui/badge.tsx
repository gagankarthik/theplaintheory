import type { ReactNode } from "react";

/**
 * Semantic tones: success (jade, green), warning (amber, orange), danger (rose, red), info (blue), and neutral.
 * Consent tones are aliases kept for existing callers: released = success, held = warning,
 * declined = danger. "brand" (the lime "on" wash) marks the current item only, e.g. the current plan.
 */
export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info" | "brand" | "released" | "held" | "declined";

const SUCCESS = "bg-success-wash text-success";
const WARNING = "bg-warning-wash text-warning";
const DANGER = "bg-destructive-wash text-destructive";
const TONE: Record<BadgeTone, string> = {
  success: SUCCESS,
  warning: WARNING,
  danger: DANGER,
  released: SUCCESS,
  held: WARNING,
  declined: DANGER,
  neutral: "bg-paper text-ink-2 ring-1 ring-inset ring-line",
  info: "bg-info-wash text-info",
  brand: "bg-selected text-on-selected",
};

/**
 * A second, shape-based channel next to the colour: a filled dot for good, a hollow ring for
 * waiting, a diamond for bad. So the state survives greyscale and colour-blindness, with the text.
 */
function Glyph({ tone }: { tone: BadgeTone }) {
  switch (tone) {
    case "success":
    case "released":
      return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;
    case "warning":
    case "held":
      return <span aria-hidden className="size-2 shrink-0 rounded-full border-[1.5px] border-current" />;
    case "danger":
    case "declined":
      return <span aria-hidden className="size-1.5 shrink-0 rotate-45 bg-current" />;
    case "brand":
      return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;
    case "info":
      return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;
    default:
      return null;
  }
}

/** Status pill. Meaning is always carried by the text; the colour and the glyph reinforce it. */
export function Badge({ tone = "neutral", children, icon, className = "" }: { tone?: BadgeTone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium leading-none ${TONE[tone]} ${className}`}>
      {icon ?? <Glyph tone={tone} />}
      {children}
    </span>
  );
}

export function PublishBadge({ dirty, published }: { dirty: boolean; published: boolean }) {
  if (!published) return <Badge tone="held">Not published</Badge>;
  if (dirty) return <Badge tone="held">Unpublished changes</Badge>;
  return <Badge tone="released">Live</Badge>;
}
