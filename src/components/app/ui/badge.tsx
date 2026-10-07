import type { ReactNode } from "react";

export type BadgeTone = "released" | "held" | "declined" | "neutral" | "brand";

const TONE: Record<BadgeTone, string> = {
  released: "bg-jade-wash text-jade",
  held: "bg-amber-wash text-amber",
  declined: "bg-rose-wash text-rose",
  neutral: "bg-paper text-ink-2 ring-1 ring-inset ring-line",
  brand: "bg-brand-wash text-brand-ink",
};
const DOT: Partial<Record<BadgeTone, string>> = { released: "bg-jade-bright", held: "bg-amber-bright", declined: "bg-rose", brand: "bg-brand" };

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
