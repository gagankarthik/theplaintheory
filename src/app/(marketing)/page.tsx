import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/marketing/json-ld";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/landing/hero";
import { Capabilities, Coverage, Facts, HowItWorks, IndustriesStrip, Integrations } from "@/components/marketing/landing/sections";
import { sdkSizeKb } from "@/lib/sdk-size";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";
import { getLivePlans } from "@/lib/stripe-catalog";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Consent management for GDPR, CCPA and DPDPA",
    description: "Consent management for GDPR, CCPA/CPRA and India's DPDPA: a consent script under 10 KB, real tracker blocking and a consent log auditors can verify.",
    path: "/",
    socialTitle: "Consent, made plain.",
  }),
  title: { absolute: `${site.name}: Consent management for GDPR, CCPA and DPDPA` },
};

const faq = (sizeKb: string): FaqItem[] => [
  {
    q: "Does it block, or only show a banner?",
    a: "It blocks them. The scripts you mark, and the trackers our cookie scanner recognises, stay off until the visitor agrees to their category. If one still fires after a visitor declines, it appears on your Leaks page with the page it fired on.",
  },
  {
    q: "How do I prove consent to an auditor?",
    a: "Every choice is saved as a consent record that is chained to the one before it, so any later change would show. Check the whole log in one click, and download an Evidence Pack with the banner you showed and the privacy signals you honoured.",
  },
  {
    q: "Which laws does it cover?",
    a: "GDPR and UK GDPR, CCPA/CPRA with Global Privacy Control, and India's DPDP Act, 2023 with the 2025 Rules. The visitor's location decides which notice they see, in their language where you've added it.",
  },
  {
    q: "Where is the data stored?",
    a: "In India, in AWS Mumbai (ap-south-1). EU or US residency is available on Enterprise, by arrangement. Raw IP addresses are never stored: they're truncated and hashed before anything is written.",
  },
  {
    q: "Will it slow my site down?",
    a: `No. The script is ${sizeKb} KB compressed, kept under a 10 KB limit, and served from a location close to each visitor. The consent banner is kept separate from your page styles, so it doesn't move your layout or change your design.`,
  },
  {
    q: "Must we register with the Board?",
    a: "No. Only Consent Managers register with India's Data Protection Board, and using one is optional. Plain Theory helps you, as the Data Fiduciary, give proper notice, record consent and handle withdrawals.",
  },
];

/** Structured-data prices come live from Stripe. */
export const revalidate = 300;

export default async function HomePage() {
  const plans = await getLivePlans();
  const sizeKb = sdkSizeKb();
  const items = faq(sizeKb);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", name: site.name, url: site.url, inLanguage: "en", publisher: { "@type": "Organization", name: site.legalName } },
            { "@type": "Organization", name: site.legalName, url: site.url, logo: absoluteUrl("/brand/app-icon.svg"), email: site.email },
            {
              "@type": "SoftwareApplication",
              name: site.name,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: site.description,
              offers: plans.filter((p) => p.priceMonthly !== null).map((p) => ({ "@type": "Offer", name: p.name, price: p.priceMonthly, priceCurrency: "USD" })),
            },
          ],
        }}
      />
      <Hero />
      <Facts sdkKb={sizeKb} />
      <Capabilities />
      <HowItWorks />
      <Coverage />
      <IndustriesStrip />
      <Integrations />
      <section aria-labelledby="faq-title" className="on-light bg-white px-5 py-14 text-soot sm:px-8 md:py-16">
        <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <h2 id="faq-title" className="text-[clamp(1.75rem,3vw,2.5rem)]">
              Questions buyers ask
            </h2>
            <p className="mt-3 text-[1.125rem] leading-[1.55] text-mute-ink">Something else? Our team replies within one business day.</p>
            <Link href="/contact?topic=sales" className="mk-stem mk-stem-line mt-6">
              Talk to sales
            </Link>
          </div>
          <div className="lg:col-span-8">
            <Faq items={items} />
          </div>
        </div>
      </section>
      <FinalCta title="Start collecting consent you can prove." lead="Free for your first website. Upgrade when you add more websites or teammates." />
    </>
  );
}
