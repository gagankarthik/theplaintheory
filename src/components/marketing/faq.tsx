import Link from "next/link";
import { IconPlus } from "@/components/icons";
import { JsonLd } from "./json-ld";

export interface FaqItem {
  q: string;
  a: string;
  /** optional follow-up link shown under the answer */
  link?: { href: string; label: string };
}

/**
 * Native <details> accordion: keyboard and screen-reader support for free, works without JavaScript.
 * Emits FAQPage structured data from the same content.
 */
export function Faq({ items, schema = true }: { items: FaqItem[]; schema?: boolean }) {
  return (
    <>
      <div className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-medium transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
              {item.q}
              <IconPlus size={18} className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45" />
            </summary>
            <div className="max-w-[68ch] pb-6 text-[15px] leading-relaxed text-ink-2">
              <p>{item.a}</p>
              {item.link ? (
                <Link href={item.link.href} className="mt-3 inline-block font-medium text-ink underline underline-offset-4 hover:text-brand">
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
