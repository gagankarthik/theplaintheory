import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { PageHero } from "@/components/marketing/page-hero";
import { INDUSTRY_LINKS } from "@/components/marketing/site-nav";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cookie Consent by Industry",
  description: "How Plain Theory handles cookie consent for e-commerce, SaaS, healthcare, financial services, media and education websites.",
  path: "/industries",
});

/** Every industry page, one card each. */
export default function IndustriesPage() {
  return (
    <>
      <PageHero
        tone="ink"
        title="Consent for your sector"
        lead="Each sector has its own trackers, risks and rules. Pick yours to see what matters and how Plain Theory handles it."
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Industries", href: "/industries" },
        ]}
      />
      <section aria-label="Industries" className="on-light bg-white px-5 py-16 text-soot sm:px-8 md:py-[88px]">
        <ul className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link href={l.href} className="flex h-full flex-col rounded-[18px] bg-chalk p-6 transition-colors hover:bg-lime">
                  {Icon ? <Icon size={24} /> : null}
                  <h2 className="mt-4 text-[1.25rem] font-semibold tracking-[-0.02em]">{l.title}</h2>
                  <p className="mt-2 text-[1rem] leading-[1.55] text-soot/80">{l.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[0.9375rem] font-medium">
                    See what matters <IconArrowRight size={16} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
