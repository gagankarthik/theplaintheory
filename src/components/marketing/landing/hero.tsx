import Link from "next/link";
import { ConsentSwitch } from "./consent-switch";

/** The first screen: what it is and what the customer gets on the left, the working consent switch on the right. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-soot text-white">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pb-14 pt-10 sm:px-8 md:pb-16 md:pt-14 lg:grid-cols-12 lg:gap-12">
        <div className="mk-fade lg:col-span-7">
          <h1 id="hero-title" className="text-[clamp(3rem,10vw,4.5rem)] md:text-[clamp(4rem,6.4vw,6.25rem)]">
            Consent,
            <br />
            made plain.
          </h1>
          <p className="mt-6 max-w-[36rem] text-[1.125rem] leading-[1.55]">
            A consent banner and cookie scanner for GDPR, CCPA and India’s DPDP Act. Tracking stays off until visitors agree, and every choice is kept as a consent record you can show an auditor.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="mk-stem mk-stem-lime">
              Start free
            </Link>
            <Link href="/contact?topic=sales" className="mk-stem mk-stem-white">
              Book a demo
            </Link>
          </div>
          <p className="mt-4 text-[1rem] text-mute">First website free. No card needed.</p>
        </div>
        <div className="lg:col-span-5">
          <ConsentSwitch />
        </div>
      </div>
    </section>
  );
}
