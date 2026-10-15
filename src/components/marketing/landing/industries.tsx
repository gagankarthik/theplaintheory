import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { INDUSTRY_LINKS } from "@/components/marketing/site-nav";

/** One tile per industry page, beside the title tile: eight cells, two rows of four on desktop. */
export function Industries() {
  return (
    <section aria-labelledby="industries-title" className="on-light bg-white px-2.5 py-12 text-soot md:py-16">
      <ul className="mx-auto grid max-w-[1440px] gap-1.5 sm:grid-cols-2 md:gap-2 lg:grid-cols-4">
        <li className="flex min-h-[160px] flex-col justify-between gap-6 rounded-[18px] bg-chalk p-6 sm:col-span-2">
          <h2 id="industries-title" className="max-w-[12ch] text-[clamp(2.25rem,4.2vw,3.75rem)]">
            Set up for your sector
          </h2>
          <Link href="/industries" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[1rem] font-medium hover:underline hover:underline-offset-4">
            All industries
            <IconArrowRight size={16} />
          </Link>
        </li>
        {INDUSTRY_LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex h-full min-h-[200px] flex-col rounded-[18px] bg-chalk p-6 transition-colors duration-150 hover:bg-lime focus-visible:!rounded-[18px]"
              >
                {Icon ? <Icon size={28} /> : null}
                <span className="mt-auto pt-8 text-[clamp(1.25rem,1.6vw,1.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{l.title}</span>
                <span className="mt-2 text-[1rem] leading-[1.5] text-soot/80">{l.description}</span>
                <IconArrowRight size={20} className="mt-4 self-end transition-transform duration-150 group-hover:translate-x-1" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
