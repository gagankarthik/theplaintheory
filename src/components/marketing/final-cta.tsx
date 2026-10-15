import Link from "next/link";

/** Closing call to action on a lime band: one sentence, one line of terms, two actions. */
export function FinalCta({
  title = "Start with one site, free.",
  lead = "Free for your first site. Upgrade when you add more sites or teammates.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="on-light bg-lime px-5 py-14 text-soot sm:px-8 md:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="cta-title" className="text-[clamp(1.75rem,3vw,2.75rem)]">
            {title}
          </h2>
          <p className="mt-2 max-w-[60ch] text-[1rem]">{lead} No card needed.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="mk-stem mk-stem-soot">
            Start free
          </Link>
          <Link href="/contact?topic=sales" className="mk-stem mk-stem-white">
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
