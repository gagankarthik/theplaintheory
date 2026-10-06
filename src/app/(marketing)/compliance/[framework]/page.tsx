import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCheck } from "@/components/icons";
import { COMPLIANCE } from "@/components/marketing/compliance/content";
import { ConsentManagerSection, ItemisedSection, LanguagesSection } from "@/components/marketing/compliance/dpdpa-sections";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageHero } from "@/components/marketing/page-hero";
import { Toc, type TocItem } from "@/components/marketing/toc";
import { COMPLIANCE_SLUGS, type ComplianceSlug } from "@/lib/marketing-routes";
import { absoluteUrl, site } from "@/lib/site";

const REVIEWED = { iso: "2026-10-01", label: "October 2026" };

const isSlug = (s: string): s is ComplianceSlug => (COMPLIANCE_SLUGS as readonly string[]).includes(s);

export function generateStaticParams() {
  return COMPLIANCE_SLUGS.map((framework) => ({ framework }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ framework: string }> }): Promise<Metadata> {
  const { framework } = await params;
  if (!isSlug(framework)) return {};
  const c = COMPLIANCE[framework];
  const path = `/compliance/${framework}`;
  return pageMetadata({ title: c.title, description: c.description, path, kicker: `${c.name} guide` });
}

export default async function CompliancePage({ params }: { params: Promise<{ framework: string }> }) {
  const { framework } = await params;
  if (!isSlug(framework)) notFound();
  const c = COMPLIANCE[framework];
  const path = `/compliance/${framework}`;

  const dpdpa = framework === "dpdpa";
  const toc: TocItem[] = [
    { id: "requirements", label: "What the law requires" },
    ...(dpdpa
      ? [
          { id: "languages", label: "Notices in 22 languages" },
          { id: "itemised", label: "Itemised notices" },
          { id: "consent-managers", label: "Consent Managers" },
        ]
      : []),
    ...(c.extra ? [{ id: "detail", label: c.extra.title }] : []),
    { id: "how", label: "How Plain Theory handles it" },
    { id: "faq", label: "Common questions" },
  ];
  const others = COMPLIANCE_SLUGS.filter((s) => s !== framework);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: c.title,
          description: c.description,
          dateModified: REVIEWED.iso,
          author: { "@type": "Organization", name: site.legalName },
          publisher: { "@type": "Organization", name: site.legalName, logo: absoluteUrl("/brand/app-icon.svg") },
          mainEntityOfPage: absoluteUrl(path),
        }}
      />
      <PageHero
        tone="paper"
        crumbs={[
          { name: "Home", href: "/" },
          { name: `${c.name} compliance`, href: path },
        ]}
        title={c.title}
        lead={c.lead}
        meta={
          <>
            Last reviewed <time dateTime={REVIEWED.iso}>{REVIEWED.label}</time>. This is guidance, not legal advice.
          </>
        }
      >
        <dl className="grid w-full gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-3">
          {c.appliesTo.map((a) => (
            <div key={a.label} className="bg-surface p-5">
              <dt className="text-xs font-medium text-ink-3">{a.label}</dt>
              <dd className="mt-1.5 text-sm text-ink">{a.value}</dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <div className="bg-surface">
        <div className="container-page grid gap-12 py-16 md:py-24 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-28">
              <Toc items={toc} />
              <div className="mt-10 border-t border-line pt-6">
                <p className="text-sm font-medium text-ink">Other regulations</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {others.map((s) => (
                    <li key={s}>
                      <Link href={`/compliance/${s}`} className="link-draw text-ink-3 hover:text-ink">
                        {COMPLIANCE[s].name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <div className="min-w-0 lg:col-span-9 lg:pl-8">
            <section id="requirements" aria-labelledby="requirements-h" className="scroll-mt-28">
              <h2 id="requirements-h" className="display text-[2rem] sm:text-[2.25rem]">
                What the law requires
              </h2>
              <ol className="mt-10 divide-y divide-line border-y border-line">
                {c.requirements.map((r) => (
                  <li key={r.title} className="grid gap-2 py-7 md:grid-cols-[minmax(0,240px)_1fr] md:gap-10">
                    <h3 className="text-lg font-semibold leading-snug">{r.title}</h3>
                    <div>
                      <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{r.body}</p>
                      {r.source ? <p className="mt-3 text-xs text-ink-3">{r.source}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {dpdpa ? (
              <>
                <LanguagesSection />
                <ItemisedSection />
                <ConsentManagerSection />
              </>
            ) : null}

            {c.extra ? (
              <section id="detail" aria-labelledby="detail-h" className="mt-20 scroll-mt-28">
                <h2 id="detail-h" className="display text-[2rem] sm:text-[2.25rem]">
                  {c.extra.title}
                </h2>
                {c.extra.body.map((p) => (
                  <p key={p} className="mt-5 max-w-[64ch] text-[1.0625rem] leading-relaxed text-ink-2">
                    {p}
                  </p>
                ))}
                {c.extra.items ? (
                  <dl className="mt-8 divide-y divide-line border-y border-line">
                    {c.extra.items.map((it) => (
                      <div key={it.term} className="grid gap-1 py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
                        <dt className="text-sm font-semibold">{it.term}</dt>
                        <dd className="text-[15px] text-ink-2">{it.detail}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>
            ) : null}

            <section id="how" aria-labelledby="how-h" className="mt-20 scroll-mt-28">
              <h2 id="how-h" className="display text-[2rem] sm:text-[2.25rem]">
                How Plain Theory handles it
              </h2>
              <p className="mt-5 max-w-[60ch] text-[1.0625rem] text-ink-2">
                Each requirement maps to something the product does by default. Nothing here needs a custom build.
              </p>
              <div className="mt-10 overflow-hidden rounded-[var(--radius-lg)] border border-line">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">
                    {c.name} requirements and the Plain Theory feature that meets each one
                  </caption>
                  <thead className="hidden bg-paper text-sm text-ink-3 sm:table-header-group">
                    <tr>
                      <th scope="col" className="w-[36%] px-6 py-3.5 font-medium">
                        Requirement
                      </th>
                      <th scope="col" className="px-6 py-3.5 font-medium">
                        In Plain Theory
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {c.mappings.map((m) => (
                      <tr key={m.requirement} className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-paper sm:table-row sm:p-0">
                        <th scope="row" className="text-sm font-semibold text-ink sm:px-6 sm:py-4">
                          {m.requirement}
                        </th>
                        <td className="text-sm text-ink-2 sm:px-6 sm:py-4">
                          <span className="flex items-start gap-2.5">
                            <IconCheck size={16} className="mt-0.5 shrink-0 text-jade" />
                            {m.feature}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="faq" aria-labelledby="faq-h" className="mt-20 scroll-mt-28">
              <h2 id="faq-h" className="display text-[2rem] sm:text-[2.25rem]">
                Common questions
              </h2>
              <div className="mt-8">
                <Faq items={c.faq} />
              </div>
            </section>
          </div>
        </div>
      </div>

      <FinalCta title={`Get ${c.name}-ready this week`} />
    </>
  );
}
