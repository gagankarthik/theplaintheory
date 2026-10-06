import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal/legal-page";
import { pageMetadata } from "@/lib/seo";
import { legal, site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Terms of service",
  description:
    "Terms for using the Plain Theory consent management platform: accounts, plans and billing, acceptable use, data protection, liability and ending the agreement.",
  path: "/legal/terms",
  kicker: "Legal",
});

const TOC = [
  { id: "agreement", label: "The agreement" },
  { id: "accounts", label: "Accounts" },
  { id: "billing", label: "Plans, billing and taxes" },
  { id: "your-duties", label: "Your responsibilities" },
  { id: "not-legal-advice", label: "Not legal advice" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "our-ip", label: "Our intellectual property" },
  { id: "data", label: "Your data" },
  { id: "confidentiality", label: "Confidentiality" },
  { id: "availability", label: "Availability" },
  { id: "suspension", label: "Suspension" },
  { id: "ending", label: "Ending the agreement" },
  { id: "warranties", label: "Warranties" },
  { id: "liability", label: "Limitation of liability" },
  { id: "indemnities", label: "Indemnities" },
  { id: "law", label: "Governing law and disputes" },
  { id: "changes", label: "Changes to these terms" },
  { id: "general", label: "General" },
  { id: "contact", label: "Contact" },
];

const legalMail = <a href={`mailto:${site.legalEmail}`}>{site.legalEmail}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" path="/legal/terms" updated={{ iso: "2026-10-06", label: "6 October 2026" }} toc={TOC}>
      <h2 id="agreement">The agreement</h2>
      <p>
        These terms are an agreement between you, or the organization you represent, and {site.legalName} (&ldquo;Plain
        Theory&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They cover the Plain Theory consent script, dashboard, APIs, framework
        packages, plugins and documentation (together, the &ldquo;service&rdquo;).
      </p>
      <p>
        By creating an account, clicking to accept, or using the service, you accept these terms. If you accept on behalf of an
        organization, you confirm you have authority to bind it, and &ldquo;you&rdquo; means that organization. If you have a
        signed order form with us, it takes priority where the two differ. Our{" "}
        <Link href="/legal/privacy">privacy notice</Link> and data processing addendum also form part of the agreement.
      </p>

      <h2 id="accounts">Accounts</h2>
      <p>
        You need an account to use the dashboard. Give us accurate details and keep them up to date. Keep your sign-in details
        private, turn on multi-factor authentication, and tell us straight away at {legalMail} if you think someone else has used
        your account.
      </p>
      <p>
        Account owners are responsible for the people they invite, the roles they give them, and everything done under the
        account. You must be at least 18 and using the service for business or professional purposes.
      </p>

      <h2 id="billing">Plans, billing and taxes</h2>
      <ul>
        <li>
          <strong>Plans.</strong> The Free plan costs nothing. Paid plans are priced per account, not per website, and billed in
          advance through Stripe, monthly or annually, in US dollars, euros, pounds sterling or Indian rupees. Annual billing charges
          10 months for 12. Enterprise pricing is set in an order form.
        </li>
        <li>
          <strong>Taxes.</strong> Prices exclude taxes. We add GST, VAT or other sales taxes where the law requires, and you pay
          them. If you give us a valid tax ID, it will appear on your invoices.
        </li>
        <li>
          <strong>Changing plans.</strong> Upgrades take effect immediately and are prorated. Downgrades take effect at the end of the
          billing period.
        </li>
        <li>
          <strong>Limits.</strong> Each plan has limits on pageviews, websites and seats. These are soft limits: if you go over, we
          tell the account owner and give you a 30-day grace period to reduce usage or change plan. We never upgrade you or charge
          for overage without your explicit choice.
        </li>
        <li>
          <strong>Failed payments.</strong> If a payment fails, we&apos;ll tell you and keep the service running for 14 days. If it
          is still unpaid after that, we may move your account to the Free plan.
        </li>
        <li>
          <strong>Renewal and refunds.</strong> Paid plans renew automatically for the same period until you cancel. You can cancel
          at any time from the Billing page and keep your plan until the end of the period you&apos;ve paid for. Fees already paid
          aren&apos;t refundable, except where the law requires or these terms say otherwise.
        </li>
        <li>
          <strong>Price changes.</strong> We&apos;ll give you at least 30 days&apos; notice of a price change. It applies from your
          next renewal.
        </li>
      </ul>

      <h2 id="your-duties">Your responsibilities</h2>
      <p>
        Plain Theory gives you the tools to collect and prove consent, but you remain responsible for your own compliance. For the
        personal data of visitors to your websites and apps, you are the controller (the Data Fiduciary under India&apos;s DPDP
        Act, and the business under the CCPA), and we process that data on your behalf. In particular, you are responsible for:
      </p>
      <ul>
        <li>the wording of your notices, the purposes and categories you configure, and the languages you choose;</li>
        <li>listing the trackers your sites load, and placing them under the categories and controls the service provides;</li>
        <li>having a lawful basis for any processing you carry out, and for how you use the data you collect;</li>
        <li>answering requests from your visitors, with our help where the service supports it;</li>
        <li>choosing a data region and retention period that suit your obligations.</li>
      </ul>

      <h2 id="not-legal-advice">Not legal advice</h2>
      <p>
        Plain Theory is a software provider, not a law firm, and we don&apos;t provide legal services. Information we give you in
        any form, written or spoken, including on our website, in the product, documentation, compliance guides, readiness
        checks, notice templates, translations, emails and support conversations, is general information only. It is not legal or
        regulatory advice, it may not reflect the latest changes in law, and it doesn&apos;t create a lawyer-client relationship.
      </p>
      <p>
        Features such as readiness scores, fairness checks and the Evidence Pack help you show what your site did; they are not a
        certification or a guarantee that you comply with GDPR, CCPA/CPRA, the DPDP Act or any other law. You should consult a
        qualified lawyer about your own obligations before relying on any of it.
      </p>

      <h2 id="acceptable-use">Acceptable use</h2>
      <p>
        You may use Plain Theory to collect and manage consent on websites and apps you operate or are authorised to manage. You
        may not:
      </p>
      <ul>
        <li>use it to mislead visitors about what data is collected, why, or who receives it;</li>
        <li>configure it to obtain consent through deception, pressure or design that makes refusing harder than accepting;</li>
        <li>use it for anything unlawful, or to process data you have no right to process;</li>
        <li>upload malware, or use the service to attack, probe or disrupt any system, including ours;</li>
        <li>break, overload or work around the service&apos;s security, limits or access controls;</li>
        <li>share accounts, or resell or sublicense the service except under a written agency or partner agreement with us.</li>
      </ul>

      <h2 id="our-ip">Our intellectual property</h2>
      <p>
        We own the service and everything in it, including the software, design, documentation, notice templates, translations and
        tracker database, and all related intellectual property rights. Subject to these terms and to paying any fees due, we grant
        you a limited, non-exclusive, non-transferable licence to use the service for your own business during the agreement, and
        to deploy our consent script on the websites and apps in your account.
      </p>
      <p>You may not, and may not help anyone else to:</p>
      <ul>
        <li>copy, modify, translate or create derivative works of the service, except as the documentation permits;</li>
        <li>
          reverse engineer, decompile or disassemble any part of it, or try to derive its source code, except where the law
          expressly allows this despite this restriction;
        </li>
        <li>scrape, crawl or extract content or data from the service, the dashboard or our website by automated means;</li>
        <li>
          access or use the service to build, train or benchmark a competing product, or publish benchmarks without our written
          permission;
        </li>
        <li>remove, hide or alter any copyright, trademark or other notices, including the &ldquo;Powered by Plain Theory&rdquo; link in the consent banner.</li>
      </ul>
      <p>
        Open-source components we publish, such as our framework packages, are licensed under the licence that comes with them
        (currently MIT), which takes priority for that component.
      </p>
      <p>
        &ldquo;Plain Theory&rdquo;, the Plain Theory logo and our product names are our trademarks. You may use them only to say
        accurately that your site uses Plain Theory, and in line with the guidance on our <Link href="/brand">brand page</Link>.
      </p>
      <p>
        If you send us ideas, suggestions or feedback, you give us a perpetual, worldwide, royalty-free right to use them without
        any obligation to you. Feedback doesn&apos;t give us any rights in your confidential information or your data.
      </p>

      <h2 id="data">Your data</h2>
      <p>
        You own the data you and your visitors put into the service (&ldquo;customer data&rdquo;). You give us the right to
        process it only to provide, secure and support the service for you, and as the law requires. We process visitor
        consent records only on your documented instructions, as set out in our data processing addendum, which forms part of these
        terms and includes the Standard Contractual Clauses where they are needed. Contact {legalMail} for a signed copy.
      </p>
      <p>
        Customer data is stored in the data region you choose. We may use aggregated, de-identified statistics about how the service
        performs, which can&apos;t identify you, your visitors or your sites, to run and improve it. Our{" "}
        <Link href="/legal/privacy">privacy notice</Link> covers the data we hold about you as a customer.
      </p>

      <h2 id="confidentiality">Confidentiality</h2>
      <p>
        Each of us will keep the other&apos;s confidential information confidential, use it only for this agreement, and share it
        only with people who need it for that purpose and are bound by similar duties. This doesn&apos;t apply to information that
        is or becomes public through no fault of the receiving party, that the receiving party already had or developed
        independently, or that it lawfully received from someone else. A party may disclose confidential information when the law
        requires, after telling the other party where it lawfully can. These duties last for five years after the agreement ends,
        and for as long as information remains a trade secret.
      </p>

      <h2 id="availability">Availability</h2>
      <p>
        We work to keep the service available at all times, but we don&apos;t promise it will be uninterrupted or error free on the
        Free, Starter and Growth plans. On the Business plan we aim to keep consent script delivery available 99.9% of the time,
        and on Enterprise 99.99%, measured monthly. Service credits, where they apply, are described in your order form or service
        level agreement and are your only remedy for missing those targets.
      </p>
      <p>
        If the service is unreachable, the script fails closed: trackers stay held and no banner is shown. We may carry out planned
        maintenance and will give notice of anything likely to affect availability.
      </p>

      <h2 id="suspension">Suspension</h2>
      <p>
        We may suspend all or part of your access, with notice where we reasonably can, if your use breaches the acceptable use
        rules, threatens the security or availability of the service for others, is unlawful, or if fees remain unpaid as described
        above. We&apos;ll limit any suspension to what&apos;s needed and restore access once the issue is fixed.
      </p>

      <h2 id="ending">Ending the agreement</h2>
      <p>
        You can cancel at any time from the Billing page. We can end the agreement on 30 days&apos; notice for any reason on the Free
        plan, or straight away if you materially breach these terms and don&apos;t fix the breach within 30 days of our notice.
      </p>
      <p>
        After the agreement ends, you keep read-only access for 30 days so you can export your consent log and Evidence Pack. After
        that we delete customer data, except where the law requires us to keep it. Sections that by their nature should survive,
        including those on intellectual property, confidentiality, liability, indemnities and governing law, survive.
      </p>

      <h2 id="warranties">Warranties</h2>
      <p>
        Each party confirms it has the right to enter into this agreement. We will provide the service with reasonable skill and
        care, and in line with the documentation in all material respects.
      </p>
      <p>
        Otherwise, and to the extent the law allows, the service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We
        don&apos;t give any other warranties, express or implied, including warranties of merchantability, fitness for a particular
        purpose, non-infringement, or that using the service will make you compliant with any law.
      </p>

      <h2 id="liability">Limitation of liability</h2>
      <p>
        Nothing in these terms limits liability that can&apos;t be limited by law, such as liability for fraud, or for death or
        personal injury caused by negligence. Nor does it limit your duty to pay fees, or either party&apos;s liability under the
        indemnities below.
      </p>
      <p>Subject to that:</p>
      <ul>
        <li>
          neither party is liable for indirect, incidental, special or consequential loss, or for loss of profits, revenue, goodwill
          or data, even if it was foreseeable;
        </li>
        <li>
          each party&apos;s total liability arising out of or in connection with this agreement is limited to the fees you paid us in
          the 12 months before the event giving rise to the claim.
        </li>
      </ul>

      <h2 id="indemnities">Indemnities</h2>
      <p>
        We will defend you against any third-party claim that the service, as we provide it, infringes that party&apos;s
        intellectual property rights, and pay the damages and costs finally awarded. If such a claim arises, we may modify the
        service so it doesn&apos;t infringe, get you the right to keep using it, or end the agreement and refund prepaid fees for
        the unused period. This doesn&apos;t cover claims arising from your content, your configuration, or combining the service
        with things we didn&apos;t provide.
      </p>
      <p>
        You will defend us against any third-party claim, including from a regulator, arising from your content, your use of the
        service in breach of these terms or the law, or your processing of your visitors&apos; personal data, and pay the damages
        and costs finally awarded.
      </p>
      <p>
        The party seeking protection must tell the other promptly, let it control the defence and settlement, and give reasonable
        help at its cost.
      </p>

      <h2 id="law">Governing law and disputes</h2>
      <p>
        These terms, and any dispute arising out of or in connection with them, are governed by {legal.governingLaw}. Before going
        to court, each of us will try in good faith to resolve a dispute by talking, starting with an email to {legalMail}. If it
        isn&apos;t resolved within 30 days, {legal.courts} have exclusive jurisdiction, unless your order form says otherwise.
        Either party may seek urgent relief from any competent court to protect its intellectual property or confidential
        information. Nothing here takes away rights you have under the mandatory consumer laws of the country where you live.
      </p>

      <h2 id="changes">Changes to these terms</h2>
      <p>
        We may update these terms as the service and the law change. We&apos;ll email account owners at least 30 days before a
        material change takes effect, and the date at the top shows when they last changed. If you don&apos;t agree with a change,
        you can cancel before it takes effect. Continuing to use the service after that means you accept the new terms.
      </p>

      <h2 id="general">General</h2>
      <ul>
        <li>
          <strong>Assignment.</strong> You may not transfer this agreement without our written consent. We may transfer it to a
          company that takes over our business or the service, and we&apos;ll tell you if we do.
        </li>
        <li>
          <strong>Force majeure.</strong> Neither party is liable for delay or failure caused by events beyond its reasonable
          control, such as natural disasters, war, internet or cloud provider outages, or government action. This doesn&apos;t
          excuse paying fees.
        </li>
        <li>
          <strong>Entire agreement.</strong> These terms, any order form, the data processing addendum and the documents they refer
          to are the whole agreement between us on this subject, and replace earlier discussions.
        </li>
        <li>
          <strong>Severability.</strong> If a court finds part of these terms unenforceable, the rest stays in effect, and that part
          is applied as closely to its intent as the law allows.
        </li>
        <li>
          <strong>No waiver.</strong> Not enforcing a right straight away doesn&apos;t mean giving it up.
        </li>
        <li>
          <strong>Notices.</strong> We send notices to the account owner&apos;s email. You send legal notices to {legalMail}.
        </li>
        <li>
          <strong>Independent parties.</strong> We are independent contractors. Nothing here creates a partnership, agency or
          employment relationship, and there are no third-party beneficiaries.
        </li>
      </ul>

      <h2 id="contact">Contact</h2>
      <ul>
        <li>Legal notices and questions about these terms: {legalMail}</li>
        <li>
          Everything else: <a href={`mailto:${site.email}`}>{site.email}</a>
        </li>
        {legal.registeredOffice ? <li>Registered office: {site.legalName}, {legal.registeredOffice}</li> : null}
        {legal.registrationNumber ? <li>Company registration number: {legal.registrationNumber}</li> : null}
        {legal.taxId ? <li>Tax registration: {legal.taxId}</li> : null}
      </ul>
    </LegalPage>
  );
}
