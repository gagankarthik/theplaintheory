import Link from "next/link";
import { Lattice } from "./lattice";
import { CtaButton } from "./primitives";

/**
 * Closing call to action: a contained ink panel on a light band, so the page ends on one focused
 * moment instead of a full-bleed colour slab. Ultramarine appears only as light inside it.
 */
export function FinalCta({
  title = "Start with one site today",
  lead = "Free for your first site. Upgrade when you add more sites or teammates.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="bg-surface py-16 md:py-24">
      <div className="container-page">
        <div data-gsap-settle className="relative isolate overflow-hidden rounded-[28px] bg-ink px-6 py-20 text-center text-white shadow-[0_60px_120px_-60px_rgba(21,18,122,0.65)] sm:px-12 md:py-28">
          <Lattice className="absolute inset-0 -z-10 h-full w-full opacity-60" />
          {/* One light source from below the headline */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[58%] -z-10 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(75,72,242,0.55),rgba(75,72,242,0))]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] ring-1 ring-inset ring-white/10" />
          <h2 id="cta-title" className="display mx-auto max-w-[760px] text-[2.25rem] sm:text-5xl md:text-6xl">
            {title}
          </h2>
          <p className="mx-auto mt-6 max-w-[540px] text-lg text-white/75">{lead}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/signup" tone="white">
              Try for free
            </CtaButton>
            <Link href="/contact-sales" className="btn btn-pill btn-lg btn-outline-light">
              Talk to sales
            </Link>
          </div>
          <p className="mt-8 text-sm text-white/55">No card needed · GDPR, CCPA/CPRA and DPDPA from one script</p>
        </div>
      </div>
    </section>
  );
}
