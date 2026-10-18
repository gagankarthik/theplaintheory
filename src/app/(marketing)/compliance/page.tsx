import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { COMPLIANCE } from "@/components/marketing/compliance/content";
import { PageHero } from "@/components/marketing/page-hero";
import { COMPLIANCE_SLUGS } from "@/lib/marketing-routes";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cookie Consent Laws: GDPR, CCPA and DPDP",
  description: "Cookie consent rules under the GDPR and UK GDPR, CCPA and CPRA, and the DPDP Act 2023, and how one banner and one consent log meet each of them.",
  path: "/compliance",
});

const ORDER = ["dpdpa", "gdpr", "ccpa"] as const satisfies readonly (typeof COMPLIANCE_SLUGS)[number][];

/** Every regulation guide, one card each. */
export default function CompliancePage() {
  return (
    <>
      <PageHero
        tone="ink"
        title="Regulations we cover"
        lead="One script shows each visitor the notice their law requires. Read what each law asks of your website, in plain terms."
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Regulations", href: "/compliance" },
        ]}
      />
      <section aria-label="Regulations" className="on-light bg-white px-5 py-16 text-soot sm:px-8 md:py-[88px]">
        <ul className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-3">
          {ORDER.map((slug) => {
            const c = COMPLIANCE[slug];
            return (
              <li key={slug}>
                <Link href={`/compliance/${slug}`} className="flex h-full flex-col rounded-[18px] bg-chalk p-6 transition-colors hover:bg-lime">
                  <span className="text-[0.9375rem] text-mute-ink">{c.name}</span>
                  <h2 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.02em]">{c.title}</h2>
                  <p className="mt-2 text-[1rem] leading-[1.55] text-soot/80">{c.lead}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[0.9375rem] font-medium">
                    Read the guide <IconArrowRight size={16} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mx-auto mt-6 max-w-[1440px] text-[0.9375rem] text-mute-ink">Plain Theory is software, not legal advice. Your lawyer decides what your website needs.</p>
      </section>
    </>
  );
}
