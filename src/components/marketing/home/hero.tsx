import Link from "next/link";
import { CtaButton } from "../primitives";
import { HeroConsentStack } from "./hero-consent-stack";
import { ToggleField } from "./toggle-field";

/**
 * Split hero: copy at one end, the consent artwork at the other, both vertically centred and
 * filling one screen on desktop. The copy enters in sequence (CSS only); the artwork stays still.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative -mt-16 overflow-hidden border-b border-line bg-surface pt-16">
      {/* Light brand wash at the top and bottom edges (the top one runs under the transparent nav bar) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-[linear-gradient(180deg,var(--color-brand-wash)_0%,color-mix(in_srgb,var(--color-brand-wash)_55%,transparent)_45%,transparent_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(0deg,var(--color-paper)_0%,color-mix(in_srgb,var(--color-paper)_60%,transparent)_45%,transparent_100%)]" />
      <ToggleField clearOf="[data-hero-art]" className="max-md:hidden [mask-image:linear-gradient(to_bottom,transparent_0,transparent_64px,black_180px)]" />

      <div className="container-page relative grid items-center gap-14 py-14 sm:py-16 xl:min-h-[calc(100svh-6.5rem-2px)] xl:grid-cols-12 xl:gap-10 xl:py-10 short:xl:py-6">
        <div className="xl:col-span-7">
          <h1 id="hero-title" className="display text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem] xl:text-[3.25rem]">
            <span className="pt-hero-in block" style={{ animationDelay: "90ms" }}>
              Consent people understand.
            </span>
            <span className="pt-hero-in block text-ink-3" style={{ animationDelay: "180ms" }}>
              Proof auditors accept.
            </span>
          </h1>

          <p className="pt-hero-in mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2" style={{ animationDelay: "270ms" }}>
            Hold trackers until visitors choose, show the right notice in every region, and keep tamper-evident proof of each
            decision.
          </p>

          <div className="pt-hero-in mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "360ms" }}>
            <CtaButton href="/signup">Try for free</CtaButton>
            <Link href="/demo" className="btn btn-pill btn-lg btn-ghost bg-white/75 backdrop-blur-sm">
              Open the demo store
            </Link>
          </div>
        </div>

        <div className="xl:col-span-5">
          <HeroConsentStack />
        </div>
      </div>
    </section>
  );
}
