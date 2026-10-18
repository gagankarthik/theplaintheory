import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { INDUSTRY_LINKS } from "@/components/marketing/site-nav";
import { Words } from "../motion";

/** One tile per industry page, beside the title tile: eight cells, two rows of four on desktop. */
export function Industries() {
  return (
    <section aria-labelledby="industries-title" className="on-light bg-white px-2.5 py-12 text-soot md:py-16">
      <ul className="mx-auto grid max-w-[1440px] gap-1.5 sm:grid-cols-2 md:gap-2 lg:grid-cols-4">
        <li className="flex min-h-[140px] flex-col justify-between gap-6 rounded-[18px] bg-chalk p-6 sm:col-span-2">
          <h2 id="industries-title" data-reveal="words" className="max-w-[12ch] text-[clamp(2.25rem,4.2vw,3.75rem)]">
            <Words text="Set up for your sector" />
          </h2>
          <Link href="/industries" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[1rem] font-medium hover:underline hover:underline-offset-4">
            All industries
            <IconArrowRight size={16} />
          </Link>
        </li>
        {INDUSTRY_LINKS.map((l, i) => {
          const Icon = l.icon;
          return (
            <li key={l.href} data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
              {/* phones: a compact row (icon, words, arrow); from sm: a tile that floods lime on hover */}
              <Link
                href={l.href}
                className="mk-sweep group grid h-full grid-cols-[auto_1fr_auto] items-start gap-x-4 rounded-[18px] bg-chalk p-5 focus-visible:!rounded-[18px] sm:flex sm:min-h-[220px] sm:flex-col sm:p-6"
              >
                {Icon ? (
                  <span className="grid size-11 place-items-center rounded-full bg-white transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[-8deg] group-hover:scale-110">
                    <Icon size={22} />
                  </span>
                ) : null}
                <span className="min-w-0 sm:mt-auto sm:pt-8">
                  <span className="block text-[clamp(1.125rem,1.6vw,1.5rem)] font-semibold leading-[1.15] tracking-[-0.03em]">{l.title}</span>
                  <span className="mt-1.5 block text-[0.9375rem] leading-[1.5] text-soot/80 sm:text-[1rem]">{l.description}</span>
                </span>
                <IconArrowRight size={20} className="mt-3 self-start transition-transform duration-300 group-hover:translate-x-1 sm:mt-4 sm:self-end" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
