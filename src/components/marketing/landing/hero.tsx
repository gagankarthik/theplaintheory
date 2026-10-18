import Link from "next/link";
import { Words } from "../motion";
import { HeroBanner } from "./hero-banner";

/**
 * The first screen: the I/O mark at enormous scale, cropped by the viewport. The ring (O, off) is lime,
 * the stem (I, on) is white: consent's two states, drawn from the logo's own geometry (stem 36 wide,
 * ring r 60 with a 26 counter, 10 apart, tops aligned). The stem rises and the ring swells into place on
 * first paint, then the two drift apart as the page scrolls. The headline lifts word by word, and a
 * working banner sits over the mark: the product, in front of its own sign.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" data-consent-fab className="relative isolate overflow-hidden bg-soot text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute bottom-[-34vw] left-1/2 w-[150vw] -translate-x-[38%] md:bottom-auto md:left-[52%] md:top-1/2 md:h-[min(132vh,1000px)] md:w-auto md:-translate-x-0 md:-translate-y-[42%]">
          <svg viewBox="0 0 166 180" className="h-auto w-full overflow-visible md:h-full md:w-auto">
            <g className="mk-hero-stem-drift">
              <rect className="mk-hero-stem" x="0" y="0" width="36" height="180" rx="18" fill="#ffffff" />
            </g>
            <g className="mk-hero-ring-drift">
              <path
                className="mk-hero-ring"
                d="M166 60a60 60 0 1 1-120 0 60 60 0 1 1 120 0z M132 60a26 26 0 1 0-52 0 26 26 0 1 0 52 0z"
                fill="var(--color-lime)"
                fillRule="evenodd"
              />
            </g>
          </svg>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-16 pt-12 sm:px-8 md:min-h-[min(calc(100svh-6.5rem),720px)] md:grid-cols-12 md:items-center">
        <div className="md:col-span-7 lg:col-span-6">
          <h1 id="hero-title" className="text-[clamp(3.25rem,13vw,4.5rem)] md:text-[clamp(4rem,6.4vw,6.25rem)]">
            <Words text="Consent," className="mk-words-load block" />
            <Words text="made plain." className="mk-words-load block" delay={1} />
          </h1>
          <p className="mk-up mt-7 max-w-[34rem] text-[1.125rem] leading-[1.5] text-white" style={{ "--d": "260ms" } as React.CSSProperties}>
            Cookie consent for GDPR, CCPA and the DPDP Act. Trackers wait until visitors say yes, and every answer is kept as a receipt anyone can check.
          </p>
          <div className="mk-up mt-9 flex flex-wrap items-center gap-x-6 gap-y-3" style={{ "--d": "360ms" } as React.CSSProperties}>
            <Link href="/auth/signup" className="mk-stem mk-stem-lime group">
              Start free
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link href="/contact?topic=sales" className="inline-flex min-h-11 items-center text-[1rem] font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors duration-150 hover:decoration-white">
              Book a demo
            </Link>
          </div>
          <p className="mk-up mt-4 text-[1rem] text-mute" style={{ "--d": "440ms" } as React.CSSProperties}>
            First site free, no card.
          </p>
        </div>
        {/* phones: under the words, over the foot of the mark; desktop: low on the right, across the ring */}
        <div className="pb-[30vw] md:col-span-5 md:col-start-8 md:self-end md:justify-self-end md:pb-0">
          <HeroBanner />
        </div>
      </div>
    </section>
  );
}
