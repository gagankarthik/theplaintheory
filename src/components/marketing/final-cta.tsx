import Link from "next/link";
import { Lattice } from "./lattice";
import { CtaButton } from "./primitives";

export function FinalCta({
  title = "Start with one site today",
  lead = "Free for your first site. Upgrade when you add more sites or teammates.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden bg-brand text-white">
      <Lattice className="absolute inset-0 h-full w-full" />
      <div className="container-page relative py-24 text-center md:py-32">
        <h2 id="cta-title" className="display mx-auto max-w-[760px] text-[2.25rem] sm:text-5xl md:text-6xl">
          {title}
        </h2>
        <p className="mx-auto mt-6 max-w-[540px] text-lg text-white/85">{lead}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <CtaButton href="/signup" tone="white">
            Try for free
          </CtaButton>
          <Link href="/contact-sales" className="btn btn-pill btn-lg btn-outline-light">
            Talk to sales
          </Link>
        </div>
      </div>
    </section>
  );
}
