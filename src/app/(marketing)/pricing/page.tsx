import { pageMetadata } from "@/lib/seo";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageHero } from "@/components/marketing/page-hero";
import { ComparisonTable } from "@/components/marketing/pricing/comparison-table";
import { Pledges } from "@/components/marketing/pricing/pledges";
import { BillingControls, PricingCards } from "@/components/marketing/pricing/pricing-explorer";
import { SavingsCalculator } from "@/components/marketing/pricing/savings-calculator";
import { Section, SectionIntro } from "@/components/marketing/primitives";
import { CURRENCIES, planPrice } from "@/lib/plans";
import { getLivePlans } from "@/lib/stripe-catalog";
import { sdkSizeLabel } from "@/lib/sdk-size";
import { absoluteUrl, site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Free for one site. Paid plans from $9 a month, priced per account, not per domain, in USD, EUR, GBP or INR. No surprise charges or automatic upgrades.",
  path: "/pricing",
  socialTitle: "Pay for your account, not your domains",
});

const FAQ: FaqItem[] = [
  {
    q: "What counts as a banner view?",
    a: "We count banner views: each time a visitor is shown the banner. Banner views are pooled across all the sites on your account, so a quiet site and a busy one share the same allowance.",
  },
  {
    q: "What happens if we go over our limit?",
    a: "Nothing breaks and nothing is charged. Your banner keeps blocking trackers and receipts keep being written. Your usage is shown on the Billing page; going over never charges you automatically, and everything keeps working for 30 days while you decide on a bigger plan or less traffic. We never move you up a plan.",
  },
  {
    q: "Do you bill in Indian rupees? Can we get a GST invoice?",
    a: "Yes, choose INR and you're billed in rupees. Prices exclude taxes. For a GST invoice, contact us.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual plans cost ten months' price for twelve months. You pay once a year, and you can switch between monthly and annual at renewal or when you change plans.",
  },
  {
    q: "Can we switch or cancel at any time?",
    a: "Yes. Upgrades apply straight away and are prorated. Downgrades and cancellations take effect at the end of the billing period, from the Billing page in one click. There's no call to book.",
  },
  {
    q: "What happens to our consent log if we cancel?",
    a: "You keep read access for 30 days to export the full log, the chain verification and your Evidence Pack. After that the log is deleted, unless you've asked us in writing to keep it for a legal hold.",
  },
];

/** Prices come live from Stripe; the page regenerates every five minutes to pick up changes. */
export const revalidate = 300;

export default async function PricingPage() {
  const plans = await getLivePlans();
  const offers = plans.flatMap((p) =>
    [
      ...CURRENCIES.map((c) => {
        const price = planPrice(p, c.id);
        return price !== null ? { currency: c.code, price } : null;
      }),
    ]
      .filter((o): o is { currency: string; price: number } => o !== null)
      .map((o) => ({
        "@type": "Offer",
        name: `${p.name} (monthly)`,
        price: o.price,
        priceCurrency: o.currency,
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
      })),
  );

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${site.name} consent management`,
          description: site.description,
          brand: { "@type": "Brand", name: site.name },
          offers,
        }}
      />
      <PageHero
        tone="brand"
        title="Pay for your account, not your domains"
        lead={`Every plan blocks trackers before consent, shows the right notice in each region and keeps a tamper-evident log, from one ${sdkSizeLabel()} script. Prices in dollars, euros, pounds or rupees.`}
      >
        <BillingControls tone="dark" />
      </PageHero>

      <div className="relative -mt-14 pb-20 md:-mt-20 md:pb-24">
        <div className="container-page">
          <PricingCards plans={plans} />
        </div>
      </div>

      <Section id="pledges" tone="ink" labelledBy="pledges-title">
        <SectionIntro
          id="pledges-title"
          tone="dark"
          align="left"
          title="Honest pricing, written down"
          lead="The most common complaints about consent tools aren't about consent. They're about billing. These are the rules we hold ourselves to."
        />
        <div className="mt-12">
          <Pledges />
        </div>
      </Section>

      <Section id="calculator" tone="paper" labelledBy="calculator-title">
        <SectionIntro
          id="calculator-title"
          align="left"
          title="See what your sites would cost"
          lead="Move the sliders to match your setup. We'll suggest the smallest plan that fits and show it next to per-domain pricing."
        />
        <div className="mt-12">
          <SavingsCalculator plans={plans} />
        </div>
      </Section>

      <Section id="compare" tone="white" labelledBy="compare-title">
        <SectionIntro id="compare-title" title="Compare every feature" align="left" />
        <div className="mt-10">
          <ComparisonTable />
        </div>
      </Section>

      <Section id="faq" tone="paper" labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <h2 id="faq-title" className="display text-[2rem] sm:text-[2.5rem]">
              Billing questions
            </h2>
            <p className="mt-4 max-w-[36ch] text-ink-2">
              Need a quote, a DPA or a security review first?{" "}
              <a href="/contact-sales" className="font-medium text-ink underline underline-offset-4">
                Talk to sales
              </a>
              .
            </p>
          </div>
          <div className="lg:col-span-8">
            <Faq items={FAQ} />
          </div>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
