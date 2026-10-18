import Image from "next/image";
import Link from "next/link";
import { siAngular, siReact, siSvelte, siVuedotjs, siWordpress, type SimpleIcon } from "simple-icons";
import { IconArrowRight } from "@/components/icons";
import { Words } from "../motion";
import { PICTURES } from "../picture-credits";

/** What one installation answers to, each tile opening its guide. */
const LAWS: { name: string; href: string }[] = [
  { name: "GDPR", href: "/compliance/gdpr" },
  { name: "UK GDPR", href: "/compliance/gdpr" },
  { name: "CCPA and CPRA", href: "/compliance/ccpa" },
  { name: "DPDP Act, 2023", href: "/compliance/dpdpa" },
  { name: "DPDP Rules, 2025", href: "/compliance/dpdpa" },
  { name: "Global Privacy Control", href: "/compliance/ccpa" },
  { name: "Google Consent Mode v2", href: "/docs#consent-mode" },
];

/** Platforms with an install guide. Official marks from Simple Icons, in one colour. */
const STACK: { name: string; icon: SimpleIcon }[] = [
  { name: "React", icon: siReact },
  { name: "Vue", icon: siVuedotjs },
  { name: "Svelte", icon: siSvelte },
  { name: "Angular", icon: siAngular },
  { name: "WordPress", icon: siWordpress },
];

const TILE =
  "mk-sweep group relative flex aspect-[3/2] flex-col justify-between rounded-[18px] bg-soot-2 p-6 focus-visible:!rounded-[18px] max-md:aspect-auto max-md:min-h-[132px]";
const NAME = "text-[clamp(1.375rem,2vw,1.8rem)] font-semibold leading-[1.05] tracking-[-0.03em]";

function Arrow() {
  return <IconArrowRight size={20} className="self-end text-mute transition-transform duration-300 group-hover:-rotate-45 group-hover:text-soot group-focus-visible:-rotate-45 group-focus-visible:text-soot" />;
}

function LawTile({ name, href, i = 0 }: { name: string; href: string; i?: number }) {
  return (
    <li data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
      <Link href={href} className={TILE}>
        <span className={NAME}>{name}</span>
        <Arrow />
      </Link>
    </li>
  );
}

/** What one installation answers to, set large on tiles; the ledger stands for the hash-chained log. */
export function Laws() {
  return (
    <section id="laws" aria-labelledby="laws-title" className="scroll-mt-16 bg-soot px-2.5 py-12 text-white md:py-16">
      <ul className="mx-auto grid max-w-[1440px] grid-cols-2 gap-1.5 md:grid-cols-4 md:gap-2">
        <li className="col-span-2 flex min-h-[120px] rounded-[18px] bg-lime p-6 text-soot md:aspect-[3/1] md:min-h-0">
          <h2 id="laws-title" data-reveal="words" className="max-w-[10ch] text-[clamp(2.25rem,4.2vw,3.75rem)]">
            <Words text="One install covers" />
          </h2>
        </li>
        {LAWS.slice(0, 6).map((l, i) => (
          <LawTile key={l.name} {...l} i={i + 2} />
        ))}
        <li data-reveal className="group relative col-span-2 overflow-hidden rounded-[18px] bg-soot-2 p-6 md:aspect-[3/1]">
          <div className="mk-ring-mask absolute transition-transform duration-700 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-105 -right-[6%] top-1/2 aspect-square w-[46%] -translate-y-1/2 max-md:w-[52%]">
            <Image src={PICTURES.accountBook.src} alt={PICTURES.accountBook.alt} fill sizes="(min-width: 768px) 24vw, 50vw" className="object-cover object-[40%_30%]" />
          </div>
          <p className={`relative max-w-[48%] ${NAME}`}>Kept like a ledger</p>
          <p className="relative mt-3 max-w-[48%] text-[1rem] leading-snug text-white/80 max-md:min-h-[6rem]">
            Every consent record is chained to the one before it, so a changed or missing entry shows.
          </p>
        </li>
        <LawTile {...LAWS[6]} i={1} />
        <li data-reveal style={{ "--i": 2 } as React.CSSProperties}>
          <Link href="/docs#frameworks" className={TILE}>
            <span className="sr-only">Install guides for React, Vue, Svelte, Angular and WordPress</span>
            <span aria-hidden className="flex flex-wrap gap-3">
              {STACK.map(({ name, icon }, i) => (
                <svg key={name} width={28} height={28} viewBox="0 0 24 24" fill="currentColor" className="transition-transform duration-300 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 40}ms` }}>
                  <path d={icon.path} />
                </svg>
              ))}
            </span>
            <span aria-hidden className="flex items-end justify-between gap-3">
              <span className={NAME}>Your stack</span>
              <Arrow />
            </span>
          </Link>
        </li>
      </ul>
      <p className="mx-auto mt-6 max-w-[1440px] px-3.5 text-[0.9375rem] text-mute">Plain Theory is software, not legal advice. Your lawyer decides what your website needs.</p>
    </section>
  );
}
