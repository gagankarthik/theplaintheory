import Link from "next/link";

/**
 * The first screen: the I/O mark at enormous scale, cropped by the viewport. The ring (O, off) is lime,
 * the stem (I, on) is white: consent's two states, drawn from the logo's own geometry (stem 36 wide,
 * ring r 60 with a 26 counter, 10 apart, tops aligned).
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-soot text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[58svh] w-[150vw] -translate-x-[38%] md:left-[52%] md:top-1/2 md:h-[min(132vh,1000px)] md:w-auto md:-translate-x-0 md:-translate-y-[42%]">
          <svg viewBox="0 0 166 180" className="h-auto w-full md:h-full md:w-auto">
            <rect x="0" y="0" width="36" height="180" rx="18" fill="#ffffff" />
            <path d="M166 60a60 60 0 1 1-120 0 60 60 0 1 1 120 0z M132 60a26 26 0 1 0-52 0 26 26 0 1 0 52 0z" fill="var(--color-lime)" fillRule="evenodd" />
          </svg>
        </div>
      </div>
      <div className="mx-auto flex min-h-[600px] max-w-[1440px] flex-col px-5 pb-[min(48svh,420px)] pt-12 sm:px-8 md:min-h-[min(calc(100svh-5rem),720px)] md:justify-center md:pb-16 md:pt-12">
        <div className="mk-fade max-w-[min(44rem,46vw)] max-md:max-w-none">
          <h1 id="hero-title" className="text-[clamp(3.25rem,11.5vw,4.5rem)] md:text-[clamp(4rem,6.4vw,6.25rem)]">
            Consent,
            <br />
            made plain.
          </h1>
          <p className="mt-7 max-w-[34rem] text-[1.125rem] leading-[1.5] text-white">
            Cookie consent for GDPR, CCPA and the DPDP Act. Trackers wait until visitors say yes, and every answer is kept as a receipt anyone can check.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/signup" className="mk-stem mk-stem-lime">
              Start free
            </Link>
            <Link href="/contact?topic=sales" className="inline-flex min-h-11 items-center text-[1rem] font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors duration-150 hover:decoration-white">
              Book a demo
            </Link>
          </div>
          <p className="mt-4 text-[1rem] text-mute">First site free, no card.</p>
        </div>
      </div>
    </section>
  );
}
