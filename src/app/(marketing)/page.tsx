import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { ChainProof } from "@/components/marketing/home/chain-proof";
import { CostOfConsent } from "@/components/marketing/home/cost-of-consent";
import { CoverageStrip } from "@/components/marketing/home/coverage-strip";
import { DpdpSection } from "@/components/marketing/home/dpdp-section";
import { Hero } from "@/components/marketing/home/hero";
import { Performance } from "@/components/marketing/home/performance";
import { PlatformGrid } from "@/components/marketing/home/platform-grid";
import { ProductTour } from "@/components/marketing/home/product-tour";
import { JsonLd } from "@/components/marketing/json-ld";
import { Section } from "@/components/marketing/primitives";
import { getLivePlans } from "@/lib/stripe-catalog";
import { sdkSizeKb } from "@/lib/sdk-size";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
  title: "Consent management for GDPR, CCPA and DPDPA",
  description: "Consent management for GDPR, CCPA/CPRA and India's DPDPA: a consent script under 10 KB, real tracker blocking and a consent log auditors can verify.",
  path: "/",
  socialTitle: "Consent people understand. Proof auditors accept.",
}),
  title: { absolute: `${site.name}: Consent management for GDPR, CCPA and DPDPA` },
};

const faq = (sizeKb: string): FaqItem[] => [
  {
    q: "Does Plain Theory block trackers before consent, or only show a banner?",
    a: "It blocks them. Scripts you mark, and known trackers it recognises, are held in place and only run after the visitor agrees to their category. If one still fires after a decline, it shows up on your Leaks page with the page and the script (and, on Business, as a signed webhook).",
  },
  {
    q: "Do we need to register with India's Data Protection Board to use a consent platform?",
    a: "No. Only Consent Managers register with the Board, and using one is optional. A consent management platform like Plain Theory helps you, the Data Fiduciary, give proper notice, collect and record consent, and handle withdrawal.",
  },
  {
    q: "How much does it cost?",
    a: "Your first site is free for good, with real tracker blocking and a 90-day consent log. Paid plans start at $9 a month and are priced per account, not per domain, in US dollars, euros, pounds or rupees. Going over a limit never switches your banner off or adds a surprise charge.",
    link: { href: "/pricing", label: "See plans and pricing" },
  },
  {
    q: "Which laws does one installation cover?",
    a: "GDPR and UK GDPR, CCPA/CPRA with Global Privacy Control, and India's DPDP Act, 2023 with the 2025 Rules. The visitor's location decides which notice they see, in their language where you've added it.",
  },
  {
    q: "How do I prove consent to an auditor or the Data Protection Board?",
    a: "Every decision is a receipt linked to the previous one by a SHA-256 hash. Verify the whole chain in one click, hand over the export so anyone can check the chain themselves, and export an Evidence Pack with the banner you showed and the signals you honoured.",
  },
  {
    q: "Where is consent data stored?",
    a: "In India, in AWS Mumbai (ap-south-1). EU or US residency is available on Enterprise, by arrangement. Raw IP addresses are never stored. They're truncated and hashed before anything is written.",
  },
  {
    q: "Will it slow my site down?",
    a: `The script is ${sizeKb} KB gzipped, with a 10 KB ceiling our build enforces, and it's served from the nearest CloudFront edge. The banner renders in its own shadow root, so it doesn't shift your layout or clash with your CSS.`,
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
            {
              "@type": "WebSite",
              name: site.name,
              url: site.url,
              inLanguage: "en",
              publisher: { "@type": "Organization", name: site.legalName },
            },
            {
              "@type": "Organization",
              name: site.legalName,
              url: site.url,
              logo: absoluteUrl("/brand/app-icon.svg"),
              email: site.email,
            },
            {
              "@type": "SoftwareApplication",
              name: site.name,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: site.description,
              offers: plans.filter((p) => p.priceMonthly !== null).map((p) => ({
                "@type": "Offer",
                name: p.name,
                price: p.priceMonthly,
                priceCurrency: "USD",
              })),
            },
          ],
        }}
      />
      {/* The story: the promise, what getting it wrong costs, the laws it covers, what it does, what your
          team sees, why the proof holds up, India, speed, then the questions buyers ask before they start */}
      <Hero />
      <CostOfConsent />
      <CoverageStrip />
      <PlatformGrid />
      <ProductTour />
      <ChainProof />
      <DpdpSection />
      <Performance sizeKb={sizeKb} />

      <Section id="faq" tone="white" labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <h2 id="faq-title" className="display text-[2rem] sm:text-[2.5rem]">
              Questions teams ask first
            </h2>
            <p className="mt-4 max-w-[36ch] text-ink-2">
              Anything else? Email{" "}
              <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
                {site.email}
              </a>
              .
            </p>
          </div>
          <div className="lg:col-span-8">
            <Faq items={items} />
          </div>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
