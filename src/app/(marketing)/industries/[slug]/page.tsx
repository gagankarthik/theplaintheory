import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/marketing/json-ld";
import { INDUSTRIES, industryBySlug } from "@/lib/industries";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const LAW: Record<string, { name: string; line: string }> = {
  dpdpa: { name: "DPDP Act, India", line: "Notice in plain language, consent per purpose, easy withdrawal and records." },
  gdpr: { name: "GDPR and UK GDPR", line: "Prior consent for non-essential cookies, equal choices and proof of consent." },
  ccpa: { name: "CCPA and CPRA", line: "A clear opt-out of sale and sharing, with Global Privacy Control honoured." },
};

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata(props: PageProps<"/industries/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const industry = industryBySlug(slug);
  if (!industry) return {};
  return pageMetadata({ title: `${industry.title}`, description: industry.lead, path: `/industries/${industry.slug}` });
}

export default async function IndustryPage(props: PageProps<"/industries/[slug]">) {
  const { slug } = await props.params;
  const industry = industryBySlug(slug);
  if (!industry) notFound();
  const others = INDUSTRIES.filter((i) => i.slug !== industry.slug);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: industry.name, item: absoluteUrl(`/industries/${industry.slug}`) },
          ],
        }}
      />

      <section aria-labelledby="page-title" className="bg-soot text-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-16 pt-10 sm:px-8 md:pb-20 lg:grid-cols-12">
          <div className="mk-fade lg:col-span-7">
            <nav aria-label="Breadcrumb" className="text-[0.9375rem] text-mute">
              <Link href="/" className="mk-link">
                Home
              </Link>{" "}
              / <span aria-current="page">{industry.name}</span>
            </nav>
            <h1 id="page-title" className="mt-6 text-[clamp(2.25rem,4.2vw,3.75rem)]">
              {industry.title}
            </h1>
            <p className="mt-6 max-w-[56ch] text-[1.125rem] leading-[1.55]">{industry.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="mk-stem mk-stem-lime">
                Start free
              </Link>
              <Link href="/contact?topic=sales" className="mk-stem mk-stem-white">
                Talk to sales
              </Link>
            </div>
          </div>
          <aside aria-label="At a glance" className="rounded-[18px] bg-soot-2 p-6 lg:col-span-5 lg:self-end">
            <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em]">What this page covers</h2>
            <ul className="mk-rings mt-4 space-y-2 text-[1rem]">
              <li>{industry.challenges.length} places consent gets hard in this industry</li>
              <li>{industry.capabilities.length} capabilities that answer them</li>
              <li>The laws one install covers, and where sector rules may add more</li>
            </ul>
          </aside>
        </div>
      </section>

      <section aria-labelledby="challenges-title" className="bg-white px-5 py-14 sm:px-8 md:py-20">
        <div className="mx-auto max-w-[1440px]">
          <h2 id="challenges-title" className="text-[clamp(1.75rem,3vw,2.75rem)]">
            Where consent gets hard
          </h2>
          <ul className="mt-8 grid gap-2 md:grid-cols-3">
            {industry.challenges.map((c) => (
              <li key={c.title} className="rounded-[18px] bg-chalk p-6">
                <h3 className="text-[1.25rem] font-semibold tracking-[-0.025em]">{c.title}</h3>
                <p className="mt-2 text-[1rem] leading-[1.55]">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="caps-title" className="bg-soot px-5 py-14 text-white sm:px-8 md:py-20">
        <div className="mx-auto max-w-[1440px]">
          <h2 id="caps-title" className="text-[clamp(1.75rem,3vw,2.75rem)]">
            What Plain Theory does about it
          </h2>
          <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {industry.capabilities.map((c) => (
              <li key={c.title}>
                <Link href={c.href} className="group flex h-full flex-col rounded-[18px] bg-soot-2 p-6 transition-colors hover:bg-soot-3">
                  <h3 className="text-[1.25rem] font-semibold tracking-[-0.025em]">{c.title}</h3>
                  <p className="mt-2 flex-1 text-[1rem] leading-[1.55] text-white/85">{c.body}</p>
                  <span className="mt-4 text-[0.9375rem] font-medium text-lime group-hover:underline">How it works</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="laws-title" className="bg-white px-5 py-14 sm:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="laws-title" className="text-[clamp(1.75rem,3vw,2.75rem)]">
              The laws it answers to
            </h2>
            <p className="mt-4 max-w-[40ch] text-[1rem] leading-[1.55]">{industry.sectorNote}</p>
            <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-[1.55] text-mute-ink">
              Plain Theory provides software, not legal advice. Using it does not by itself make a website compliant.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3 lg:col-span-8">
            {industry.laws.map((l) => (
              <li key={l}>
                <Link href={`/compliance/${l}`} className="flex h-full flex-col rounded-[18px] bg-chalk p-6 transition-colors hover:bg-lime">
                  <h3 className="text-[1.25rem] font-semibold tracking-[-0.025em]">{LAW[l].name}</h3>
                  <p className="mt-2 text-[1rem] leading-[1.55]">{LAW[l].line}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="next-title" className="bg-lime px-5 py-14 text-soot sm:px-8 md:py-16">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="next-title" className="text-[clamp(1.75rem,3vw,2.75rem)]">
              Start with one site, free.
            </h2>
            <p className="mt-2 text-[1rem]">Real blocking and a 90-day consent log on the free plan. No card needed.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="mk-stem mk-stem-soot">
              Start free
            </Link>
            <Link href="/contact?topic=sales" className="mk-stem mk-stem-white">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>

      <nav aria-labelledby="others-title" className="bg-chalk px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[1440px]">
          <h2 id="others-title" className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            Other industries
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/industries/${o.slug}`} className="mk-stem mk-stem-white min-h-10 px-4 text-[0.9375rem]">
                  {o.menu}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
