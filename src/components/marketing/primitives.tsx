import Link from "next/link";
import { Magnetic } from "@/components/motion/magnetic";
import type { ComponentProps, ReactNode } from "react";

export type Tone = "white" | "paper" | "ink" | "brand";

const TONE: Record<Tone, string> = {
  white: "bg-surface text-ink",
  paper: "bg-paper text-ink",
  ink: "bg-ink text-white",
  brand: "bg-brand text-white",
};

/** Page section with consistent vertical rhythm. `id` doubles as the in-page anchor. */
export function Section({
  id,
  tone = "white",
  className = "",
  children,
  labelledBy,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${TONE[tone]} py-24 md:py-32 ${className}`}>
      <div className="container-page">{children}</div>
    </section>
  );
}

/** Section heading and lead. Centred by default; `align="left"` for asymmetric layouts. */
export function SectionIntro({
  id,
  title,
  lead,
  align = "center",
  tone = "light",
  children,
}: {
  id?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  tone?: "light" | "dark";
  children?: ReactNode;
}) {
  const centred = align === "center";
  return (
    <header className={`pt-reveal ${centred ? "mx-auto max-w-[760px] text-center" : "max-w-[640px]"}`}>
      <h2 id={id} className="display text-[2rem] sm:text-[2.5rem] md:text-[3rem]">
        {title}
      </h2>
      {lead ? (
        <p className={`mt-5 text-lg ${centred ? "mx-auto max-w-[600px]" : "max-w-[560px]"} ${tone === "dark" ? "text-white/70" : "text-ink-2"}`}>
          {lead}
        </p>
      ) : null}
      {children ? <div className={`mt-8 flex flex-wrap gap-3 ${centred ? "justify-center" : ""}`}>{children}</div> : null}
    </header>
  );
}

/** Inline text link with a chevron that nudges on hover. */
export function ArrowLink({ className = "", children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`group inline-flex items-center gap-1.5 text-sm font-medium ${className}`}>
      <span className="link-draw">{children}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
        <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

/** Small status indicator with a text label: never colour alone. */
export function StatusDot({ state, children }: { state: "released" | "held" | "declined" | "neutral"; children: ReactNode }) {
  const dot = { released: "bg-jade-bright", held: "bg-amber-bright", declined: "bg-rose", neutral: "bg-ink-3" }[state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

/**
 * Double-bezel frame: an outer tray (soft tint, hairline, padding, large radius) holding the content
 * on an inner surface with a concentric smaller radius. Used for the key product visuals.
 */
export function Bezel({ children, tone = "light", className = "" }: { children: ReactNode; tone?: "light" | "dark"; className?: string }) {
  const tray =
    tone === "dark"
      ? "bg-white/[0.04] ring-white/10 shadow-[0_40px_80px_-40px_rgba(11,16,32,0.6)]"
      : "bg-white/55 ring-ink/[0.06] shadow-[0_1px_2px_rgba(11,16,32,0.04),0_32px_64px_-32px_rgba(11,16,32,0.28)] backdrop-blur-sm";
  return (
    <div className={`rounded-[26px] p-2 ring-1 ring-inset shorter:p-1.5 ${tray} ${className}`}>
      <div className="overflow-hidden rounded-[18px] [&>*]:rounded-[18px]">{children}</div>
    </div>
  );
}

/**
 * Primary pill CTA with the arrow nested in its own circle, which nudges on hover. Ultramarine is the
 * one action colour; on ink or ultramarine sections use tone="white".
 */
export function CtaButton({
  href,
  children,
  tone = "brand",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: "brand" | "white";
  className?: string;
}) {
  const shell = tone === "white" ? "bg-white text-ink hover:bg-brand-wash" : "bg-brand text-white shadow-[0_10px_24px_-12px_rgba(46,43,214,0.7)] hover:bg-brand-ink";
  const knob = tone === "white" ? "bg-brand/10 text-brand" : "bg-white/20";
  return (
    <Magnetic className="[&>*]:flex-1">
      <Link
        href={href}
        className={`group inline-flex h-12 items-center gap-3 rounded-full pl-5 pr-1.5 text-base font-medium tracking-[-0.01em] transition-[background-color,scale] duration-300 ease-[var(--ease-spring)] active:scale-[0.98] ${shell} ${className}`}
      >
        {children}
        <span data-magnetic-knob className={`grid size-9 place-items-center rounded-full transition-[scale] duration-300 ease-[var(--ease-spring)] group-hover:scale-105 ${knob}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3.5 8h8.5M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    </Magnetic>
  );
}
