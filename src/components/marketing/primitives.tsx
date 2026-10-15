import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type Tone = "white" | "paper" | "ink" | "brand";

const TONE: Record<Tone, string> = {
  white: "on-light bg-white text-soot",
  paper: "on-light bg-chalk text-soot",
  ink: "bg-soot text-white",
  brand: "on-light bg-lime text-soot",
};

/** Page section on one of the four grounds, with the site's single rhythm. `id` doubles as the anchor. */
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
    <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-4 ${TONE[tone]} px-5 py-14 sm:px-8 md:py-20 ${className}`}>
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </section>
  );
}

/** Section heading and lead, flush left by default. */
export function SectionIntro({
  id,
  title,
  lead,
  align = "left",
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
    <header className={centred ? "mx-auto max-w-[760px] text-center" : "max-w-[720px]"}>
      <h2 id={id} className="text-[clamp(1.75rem,3vw,2.75rem)]">
        {title}
      </h2>
      {lead ? <p className={`mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55] ${centred ? "mx-auto" : ""} ${tone === "dark" ? "text-white" : "text-soot"}`}>{lead}</p> : null}
      {children ? <div className={`mt-6 flex flex-wrap gap-3 ${centred ? "justify-center" : ""}`}>{children}</div> : null}
    </header>
  );
}

/** Inline text link with an arrow. */
export function ArrowLink({ className = "", children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`mk-link inline-flex items-center gap-1.5 text-[1rem] font-medium ${className}`}>
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** Small status indicator with a text label: never colour alone. */
export function StatusDot({ state, children }: { state: "released" | "held" | "declined" | "neutral"; children: ReactNode }) {
  const dot = { released: "bg-jade-bright", held: "bg-amber-bright", declined: "bg-rose", neutral: "bg-ink-3" }[state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

/** A filled stage for product visuals: one tone step off the ground, no lines, no shadow. */
export function Bezel({ children, tone = "light", className = "" }: { children: ReactNode; tone?: "light" | "dark"; className?: string }) {
  return <div className={`overflow-hidden rounded-[22px] p-2 ${tone === "dark" ? "bg-soot-2" : "bg-chalk"} ${className}`}>{children}</div>;
}

/** The site's one button shape (the stem of the mark): lime on dark grounds, soot on light ones. */
export function CtaButton({ href, children, tone = "brand", className = "" }: { href: string; children: ReactNode; tone?: "brand" | "white"; className?: string }) {
  return (
    <Link href={href} className={`mk-stem ${tone === "white" ? "mk-stem-lime" : "mk-stem-soot"} ${className}`}>
      {children}
    </Link>
  );
}
