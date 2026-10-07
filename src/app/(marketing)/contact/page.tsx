import Link from "next/link";
import type { ComponentType } from "react";
import { IconBook, IconBuilding, IconClock, IconLifebuoy, IconPartners, IconTag, type IconProps } from "@/components/icons";
import { Breadcrumbs } from "@/components/marketing/page-hero";
import { RESPONSE_TIMES } from "@/lib/lead-options";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact us",
  description: "Raise a support ticket, talk to sales, browse the Help Center, or reach our partner and enterprise teams. Replies within one business day.",
  path: "/contact",
  socialTitle: "How can we help?",
});

interface Option {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: ComponentType<IconProps>;
}

const PRIMARY: Option[] = [
  {
    title: "Get support",
    description: "Something not working as expected? Raise a ticket with our support engineers.",
    href: "/contact/support",
    action: "Raise a ticket",
    icon: IconLifebuoy,
  },
  {
    title: "Contact sales",
    description: "Pricing, plan comparison, or whether we cover a specific regulation. No account needed.",
    href: "/contact-sales",
    action: "Contact sales",
    icon: IconTag,
  },
];

const MORE: Option[] = [
  {
    title: "Help Center",
    description: "Setup guides, troubleshooting, and answers to the questions we get most.",
    href: "/docs",
    action: "Browse Help Center",
    icon: IconBook,
  },
  {
    title: "Partner support",
    description: "Get help with account, campaign, and program queries for agency, affiliate, and strategic partnerships.",
    href: "/contact/partners",
    action: "Submit a request",
    icon: IconPartners,
  },
  {
    title: "Enterprise and compliance",
    description: "DPA requests, data residency, audit trails, custom terms, and procurement.",
    href: "/contact/enterprise",
    action: "Submit an enterprise request",
    icon: IconBuilding,
  },
];

const EMAILS = [
  { address: site.email, use: "Support and general questions", time: "Within one business day" },
  { address: "sales@theplaintheory.in", use: "Pricing, plans and enterprise rollouts", time: "Within one business day" },
  { address: site.privacyEmail, use: "Privacy requests, data subject rights and DPDP grievances", time: "Within 30 days, as our privacy notice sets out" },
];

function OptionCard({ o, primary, headingLevel }: { o: Option; primary?: boolean; headingLevel: "h2" | "h3" }) {
  const Icon = o.icon;
  const H = headingLevel;
  const id = `opt-${o.href.replace(/\W+/g, "-")}`;
  return (
    <li
      data-anim
      className={`group relative flex flex-col rounded-[var(--radius-xl)] bg-white ring-1 ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lift)] ${primary ? "p-6 sm:p-8" : "p-6"}`}
    >
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-[12px] ring-1 ring-inset transition-colors ${primary ? "size-12 bg-brand-wash text-brand ring-brand/15" : "size-11 bg-paper text-ink-2 ring-line group-hover:text-brand"}`}
      >
        <Icon size={primary ? 24 : 22} />
      </span>
      <H id={id} className={`mt-5 font-semibold tracking-[-0.02em] text-ink ${primary ? "text-2xl" : "text-lg"}`}>
        {o.title}
      </H>
      <p className={`mt-2 flex-1 text-ink-2 ${primary ? "text-base sm:text-[17px]" : "text-[15px]"}`}>{o.description}</p>
      <div className="mt-6">
        <Link
          href={o.href}
          aria-describedby={id}
          className={`btn btn-pill w-full sm:w-auto ${primary ? "btn-primary btn-lg" : "btn-ghost h-11"} after:absolute after:inset-0 after:rounded-[var(--radius-xl)] after:content-['']`}
        >
          {o.action}
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
            <path d="M3.5 8h8.5M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </li>
  );
}

export default function ContactPage() {
  return (
    <>
      <section aria-labelledby="page-title" className="border-b border-line bg-paper">
        <div className="container-page pb-12 pt-12 md:pb-16 md:pt-20">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Contact", href: "/contact" },
            ]}
          />
          <h1 id="page-title" className="display mt-6 max-w-[16ch] text-[2.5rem] sm:text-5xl md:text-[3.5rem]">
            How can we help?
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg text-ink-2 md:text-xl">Choose the team that fits your question. Every request gets a reference number and a reply from a person.</p>

          <ul className="mt-12 grid gap-4 md:grid-cols-2 md:gap-6" aria-label="Main contact options">
            {PRIMARY.map((o) => (
              <OptionCard key={o.href} o={o} primary headingLevel="h2" />
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="more-title" className="bg-surface">
        <div className="container-page py-16 md:py-20">
          <h2 id="more-title" className="text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
            Not a technical issue?
          </h2>
          <p className="mt-2 max-w-[60ch] text-[17px] text-ink-2">Find answers yourself, or reach the teams that look after partners and enterprise customers.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {MORE.map((o) => (
              <OptionCard key={o.href} o={o} headingLevel="h3" />
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="email-title" className="border-t border-line bg-paper">
        <div className="container-page grid gap-10 py-16 md:py-20 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 id="email-title" className="text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
              Email us directly
            </h2>
            <p className="mt-2 text-[17px] text-ink-2">Write to the address that matches your question, so it reaches the right person first time.</p>
            <div className="mt-6 flex gap-3 rounded-[var(--radius-lg)] bg-white p-4 ring-1 ring-line">
              <IconClock size={20} className="mt-0.5 shrink-0 text-ink" />
              <p className="text-[15px] text-ink-2">
                <span className="font-semibold text-ink">Response times. </span>
                {RESPONSE_TIMES.support} Sales, partner and enterprise requests also get a reply within one business day.
              </p>
            </div>
          </div>
          <dl className="divide-y divide-line self-start rounded-[var(--radius-xl)] bg-white ring-1 ring-line lg:col-span-8">
            {EMAILS.map((e) => (
              <div key={e.address} className="grid gap-1 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6">
                <dt className="min-w-0">
                  <a href={`mailto:${e.address}`} className="inline-flex min-h-11 items-center break-all text-base font-semibold text-brand underline-offset-4 hover:underline sm:min-h-0">
                    {e.address}
                  </a>
                  <span className="block text-[15px] text-ink-2">{e.use}</span>
                </dt>
                <dd className="text-sm text-ink-3 sm:text-right">{e.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
