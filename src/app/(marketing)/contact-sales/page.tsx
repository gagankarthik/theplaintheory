import { connection } from "next/server";
import { pageMetadata } from "@/lib/seo";
import { ContactSalesForm } from "@/components/marketing/contact/contact-sales-form";
import { IconCheck } from "@/components/icons";
import { issueFormToken } from "@/lib/form-guard";

export const metadata = pageMetadata({
  title: "Talk to sales",
  description: "Plan an enterprise rollout of Plain Theory: data residency, single sign-on, a 99.99% SLA and a named compliance contact. We reply within one business day.",
  path: "/contact-sales",
  socialTitle: "Plan your rollout with our team",
});

const WHAT_YOU_GET = [
  "A walkthrough on your own site, with your trackers held and released",
  "Volume pricing for many sites or more than 250k pageviews a month",
  "Data residency in Mumbai, Hyderabad or Frankfurt",
  "Security review support: our answers, DPA and architecture notes",
  "A named contact for your DPDPA, GDPR or CCPA rollout",
];

export default async function ContactSalesPage() {
  // Render per request: the form carries a signed render timestamp for the spam time trap.
  await connection();
  const formToken = issueFormToken("contact-sales");
  return (
    <section aria-labelledby="contact-title" className="bg-paper">
      <div className="container-page grid gap-12 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <h1 id="contact-title" className="display text-[2.5rem] sm:text-5xl">
            Talk to sales
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-ink-2">
            For teams running many sites, high traffic, or answering to auditors. Small sites can{" "}
            <a href="/signup" className="font-medium text-ink underline underline-offset-4">
              start free
            </a>{" "}
            without talking to anyone.
          </p>
          <ul className="mt-10 space-y-4 border-t border-line pt-8">
            {WHAT_YOU_GET.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] text-ink-2">
                <IconCheck size={18} className="mt-0.5 shrink-0 text-ink" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-ink-3">
            Prefer email? Write to{" "}
            <a href="mailto:sales@theplaintheory.in" className="font-medium text-ink underline underline-offset-4">
              sales@theplaintheory.in
            </a>
            . We reply within one business day.
          </p>
          <p className="mt-3 text-sm text-ink-3">
            Already a customer with a problem?{" "}
            <a href="/contact/support" className="font-medium text-ink underline underline-offset-4">
              Raise a support ticket
            </a>{" "}
            or see{" "}
            <a href="/contact" className="font-medium text-ink underline underline-offset-4">
              all contact options
            </a>
            .
          </p>
        </div>

        <div className="lg:col-span-7">
          <div className="relative rounded-[var(--radius-xl)] bg-white p-6 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-8">
            <ContactSalesForm formToken={formToken} />
          </div>
        </div>
      </div>
    </section>
  );
}
