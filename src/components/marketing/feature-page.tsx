import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight } from "@/components/icons";
import { Faq, type FaqItem } from "./faq";
import { Words } from "./motion";
import { Section } from "./primitives";
import { COMPLIANCE_LINKS, FEATURE_LINKS } from "./site-nav";

/**
 * Shared parts of the four product pages (consent banner, cookie scanner, Google Consent Mode, consent
 * log): the section heading with its word reveal, the hero actions, the FAQ block and the closing band
 * that links the laws, the docs and the other three pages.
 */

/** A section heading whose words rise out of their masks as it scrolls in. */
export function FeatureHeading({ id, text, className = "" }: { id: string; text: string; className?: string }) {
  return (
    <h2 id={id} data-reveal="words" className={`max-w-[20ch] text-[clamp(1.75rem,3.2vw,2.875rem)] ${className}`}>
      <Words text={text} />
    </h2>
  );
}

/** The hero's two actions, on soot. */
export function HeroActions({ docs }: { docs: string }) {
  return (
    <>
      <Link href="/auth/signup" className="mk-stem mk-stem-lime">
        Start free
      </Link>
      <Link href={docs} className="mk-stem mk-stem-outline">
        Read the docs
      </Link>
    </>
  );
}

/** Ring-bulleted list with the site's body measure. */
export function Rings({ items, className = "" }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={`mk-rings space-y-3 text-[1rem] leading-[1.6] ${className}`}>
      {items.map((it, i) => (
        <li key={i} data-reveal style={{ "--i": i } as React.CSSProperties}>
          {it}
        </li>
      ))}
    </ul>
  );
}

/** Questions on the page, with FAQPage structured data from the same content. */
export function FeatureFaq({ items, title = "Common questions" }: { items: FaqItem[]; title?: string }) {
  return (
    <Section id="faq" tone="white" labelledBy="faq-h">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <FeatureHeading id="faq-h" text={title} />
          <p className="mt-4 max-w-[36ch] text-[1rem] leading-[1.55] text-mute-ink">
            Something else?{" "}
            <Link href="/contact?topic=sales" className="mk-link font-medium text-soot">
              Ask our team
            </Link>
            . We reply within one business day.
          </p>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <Faq items={items} />
        </div>
      </div>
    </Section>
  );
}

/**
 * The close: the laws and docs this page answers to and the other product pages. The call to action
 * itself is the footer's, right below.
 */
export function FeatureClose({ current }: { current: string }) {
  const others = FEATURE_LINKS.filter((l) => l.href !== current);
  return (
    <Section tone="paper">
      <div className="grid gap-10 md:grid-cols-2">
        <nav aria-labelledby="close-laws-h">
          <h2 id="close-laws-h" className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            Laws and guides
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {[...COMPLIANCE_LINKS, { href: "/docs", title: "Documentation", description: "Install, blocking, the JavaScript API and the REST API." }].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group flex min-h-14 items-center justify-between gap-4 py-3">
                  <span>
                    <span className="block font-medium">{l.title}</span>
                    {l.description ? <span className="block text-[0.9375rem] text-mute-ink">{l.description}</span> : null}
                  </span>
                  <IconArrowRight size={18} className="shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="close-more-h">
          <h2 id="close-more-h" className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            More of the platform
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {others.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group flex min-h-14 items-center justify-between gap-4 py-3">
                  <span>
                    <span className="block font-medium">{l.title}</span>
                    <span className="block text-[0.9375rem] text-mute-ink">{l.description}</span>
                  </span>
                  <IconArrowRight size={18} className="shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mt-8 text-[0.9375rem] text-mute-ink">Plain Theory is software, not legal advice. Your lawyer decides what your website needs.</p>
    </Section>
  );
}

/** Product fragment frame: a filled stage one step off its ground. */
export function Stage({ tone = "light", className = "", label, children }: { tone?: "light" | "dark"; className?: string; label?: string; children: ReactNode }) {
  return (
    <figure data-reveal="scale" className={`rounded-[22px] p-4 sm:p-6 ${tone === "dark" ? "bg-soot-2" : "bg-chalk"} ${className}`}>
      {children}
      {label ? <figcaption className={`mt-3 text-[0.875rem] ${tone === "dark" ? "text-mute" : "text-mute-ink"}`}>{label}</figcaption> : null}
    </figure>
  );
}

/** A code fragment that wraps instead of scrolling, so it never widens a phone screen. */
export function CodeFragment({ code, title }: { code: string; title: string }) {
  return (
    <div className="rounded-[14px] bg-soot text-white">
      <p className="border-b border-white/10 px-4 py-2.5 text-[0.8125rem] text-mute">{title}</p>
      <pre className="whitespace-pre-wrap px-4 py-4 font-mono text-[0.8125rem] leading-[1.7] [overflow-wrap:anywhere]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
