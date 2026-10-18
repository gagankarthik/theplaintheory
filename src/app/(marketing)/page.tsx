import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/json-ld";
import { Board } from "@/components/marketing/landing/board";
import { ConsentSwitch } from "@/components/marketing/landing/consent-switch";
import { FaqCards, type FaqCard } from "@/components/marketing/landing/faq-cards";
import { Hero } from "@/components/marketing/landing/hero";
import { Industries } from "@/components/marketing/landing/industries";
import { Install } from "@/components/marketing/landing/install";
import { Laws } from "@/components/marketing/landing/laws";
import { ReceiptStrip } from "@/components/marketing/landing/receipt-strip";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";
import { getLivePlans } from "@/lib/stripe-catalog";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Consent management for GDPR, CCPA and DPDPA",
    description: "Consent management for GDPR, CCPA/CPRA and DPDPA: real tracker blocking, notices in your visitors' languages and a consent log auditors can verify.",
    path: "/",
    socialTitle: "Consent, made plain.",
  }),
  title: { absolute: `${site.name}: Consent management for GDPR, CCPA and DPDPA` },
};

const FAQ: FaqCard[] = [
  {
    topic: "Blocking",
    q: "Does it block, or only show a banner?",
    a: "It blocks them. The scripts you mark, and the trackers our cookie scanner recognises, stay off until the visitor agrees to their category. If one still fires after a visitor declines, it appears on your Leaks page with the page it fired on.",
  },
  {
    topic: "Proof",
    q: "How do I prove consent to an auditor?",
    a: "Every choice is saved as a consent record that is chained to the one before it, so any later change would show. Check the whole log in one click, and download an Evidence Pack with the banner you showed and the privacy signals you honoured.",
  },
  {
    topic: "Laws",
    q: "Which laws does it cover?",
    a: "GDPR and UK GDPR, CCPA/CPRA with Global Privacy Control, and the DPDP Act, 2023 with the 2025 Rules. The visitor's location decides which notice they see, in their language where you've added it.",
  },
  {
    topic: "Storage",
    q: "Where is the data stored?",
    a: "In a single data region, encrypted at rest and in transit, and nowhere else. Dedicated data residency is available on Enterprise. Raw IP addresses are never stored: they're truncated and hashed before anything is written.",
  },
  {
    topic: "Speed",
    q: "Will it slow my site down?",
    a: "No. The script is small, loads once per visit and is served from a location close to each visitor. The consent banner is kept separate from your page styles, so it doesn't move your layout or change your design.",
  },
  {
    topic: "Registration",
    q: "Must we register with the Board?",
    a: "No. Only Consent Managers register with the Data Protection Board, and using one is optional. Plain Theory helps you, as the Data Fiduciary, give proper notice, record consent and handle withdrawals.",
  },
];

/** Structured-data prices come live from Stripe. */
export const revalidate = 300;

export default async function HomePage() {
  const plans = await getLivePlans();
  const items = FAQ;
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
            {
              "@type": "FAQPage",
              mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
            },
          ],
        }}
      />
      <Hero />
      <ConsentSwitch />
      <ReceiptStrip />
      <Board />
      <Install />
      <Laws />
      <Industries />
      <FaqCards items={items} />
    </>
  );
}
