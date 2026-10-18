import Link from "next/link";
import { connection } from "next/server";
import { ContactSalesForm } from "@/components/marketing/contact/contact-sales-form";
import { EnterpriseForm } from "@/components/marketing/contact/enterprise-form";
import { PartnerForm } from "@/components/marketing/contact/partner-form";
import { SupportForm } from "@/components/marketing/contact/support-form";
import { Breadcrumbs } from "@/components/marketing/page-hero";
import { issueFormToken, type FormName } from "@/lib/form-guard";
import { RESPONSE_TIMES } from "@/lib/lead-options";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import type { LeadTopic } from "@/lib/types";

export const metadata = pageMetadata({
  title: "Contact Sales and Support",
  description: "Talk to sales, raise a support ticket or reach our enterprise and partner teams from one form. Every request gets a reference number and a reply within a day.",
  path: "/contact",
  socialTitle: "How can we help?",
});

interface Topic {
  id: "sales" | "support" | "enterprise" | "partners";
  lead: LeadTopic;
  label: string;
  intro: string;
  form: FormName;
}

const TOPICS: Topic[] = [
  { id: "sales", lead: "sales", label: "Sales", intro: "Plans, volume pricing, or a walkthrough on your own site. Small sites can start free without talking to anyone.", form: "contact-sales" },
  { id: "support", lead: "support", label: "Support", intro: "Banner not showing, a tracker not blocked, or a problem with the consent log or billing. Include your site's domain if you can.", form: "contact-support" },
  { id: "enterprise", lead: "enterprise", label: "Enterprise and compliance", intro: "DPA requests, data residency, audit evidence, custom terms, security questionnaires and procurement.", form: "contact-enterprise" },
  { id: "partners", lead: "partner", label: "Partners", intro: "Account, campaign and programme questions for agency, affiliate, technology and strategic partners.", form: "contact-partners" },
];

const EMAILS = [
  { address: "sales@theplaintheory.in", use: "Sales and enterprise" },
  { address: site.email, use: "Support and general questions" },
  { address: site.privacyEmail, use: "Privacy requests and DPDP grievances" },
];

/**
 * One contact page. The topic links swap the form underneath (they are plain links, so it works
 * without script); each topic keeps its own fields, validation, spam guard and lead record.
 */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  // Render per request: each form carries a signed render timestamp for the spam time trap.
  await connection();
  const { topic: asked } = await searchParams;
  const topic = TOPICS.find((t) => t.id === asked) ?? TOPICS[0];
  const formToken = issueFormToken(topic.form);

  return (
    <section aria-labelledby="page-title" className="bg-soot px-5 pb-14 pt-8 text-white sm:px-8 md:pb-16">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <Breadcrumbs
            tone="dark"
            items={[
              { name: "Home", href: "/" },
              { name: "Contact", href: "/contact" },
            ]}
          />
          <h1 id="page-title" className="mk-fade mt-6 text-[clamp(2.25rem,4.2vw,3.75rem)]">
            Contact us
          </h1>
          <p className="mt-4 max-w-[44ch] text-[1.125rem] leading-[1.55]">
            Pick a topic and send one form. Every request gets a reference number and a reply from a person.
          </p>
          <aside aria-label="Other ways to reach us" className="mt-8 space-y-5 rounded-[22px] bg-soot-2 p-6">
            <div>
              <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em]">Response time</h2>
              <p className="mt-1 text-[1rem] text-white/85">{RESPONSE_TIMES[topic.lead]}</p>
            </div>
            <div>
              <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em]">Prefer email?</h2>
              <ul className="mt-2 space-y-2">
                {EMAILS.map((e) => (
                  <li key={e.address} className="text-[1rem]">
                    <a href={`mailto:${e.address}`} className="mk-link break-all font-medium text-white">
                      {e.address}
                    </a>
                    <span className="block text-white/70">{e.use}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[1rem] text-white/85">
              Setting up?{" "}
              <Link href="/docs" className="mk-link font-medium text-lime">
                Read the documentation
              </Link>
              .
            </p>
          </aside>
        </div>

        <div className="on-light min-w-0 lg:col-span-8">
          <nav aria-label="Contact topic">
            <ul className="flex flex-wrap gap-1.5">
              {TOPICS.map((t) => {
                const current = t.id === topic.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/contact?topic=${t.id}`}
                      scroll={false}
                      aria-current={current ? "page" : undefined}
                      className={`inline-flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-medium transition-colors ${current ? "bg-lime text-soot" : "bg-soot-2 text-white hover:bg-soot-3"}`}
                    >
                      {t.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-3 rounded-[22px] bg-white p-5 text-soot sm:p-8">
            <h2 className="text-[1.5rem] font-semibold tracking-[-0.03em]">{topic.label}</h2>
            <p className="mt-1 mb-6 max-w-[62ch] text-[1rem] text-mute-ink">{topic.intro}</p>
            {topic.id === "sales" ? <ContactSalesForm key="sales" formToken={formToken} /> : null}
            {topic.id === "support" ? <SupportForm key="support" formToken={formToken} /> : null}
            {topic.id === "enterprise" ? <EnterpriseForm key="enterprise" formToken={formToken} /> : null}
            {topic.id === "partners" ? <PartnerForm key="partners" formToken={formToken} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
