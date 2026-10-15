import Link from "next/link";
import { JsonLd } from "./json-ld";

export interface FaqItem {
  q: string;
  a: string;
  /** optional follow-up link shown under the answer */
  link?: { href: string; label: string };
}

/**
 * Native <details> accordion on filled cards: keyboard and screen-reader support for free, works
 * without JavaScript. Emits FAQPage structured data from the same content.
 */
export function Faq({ items, schema = true }: { items: FaqItem[]; schema?: boolean }) {
  return (
    <>
      <div className="space-y-2">
        {items.map((item) => (
          <details key={item.q} className="group rounded-[18px] bg-chalk open:bg-white open:ring-2 open:ring-soot">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 text-left text-[1.125rem] font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden className="size-[0.7em] shrink-0 rounded-full border-[0.18em] border-current group-open:bg-current" />
            </summary>
            <div className="max-w-[68ch] px-5 pb-5 text-[1rem] leading-relaxed">
              <p>{item.a}</p>
              {item.link ? (
                <Link href={item.link.href} className="mk-link mt-3 inline-block font-medium">
                  {item.link.label}
                </Link>
              ) : null}
            </div>
          </details>
        ))}
      </div>
      {schema ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
          }}
        />
      ) : null}
    </>
  );
}
