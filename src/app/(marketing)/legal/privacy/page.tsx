import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal/legal-page";
import { LegalTable } from "@/components/marketing/legal/legal-table";
import { pageMetadata } from "@/lib/seo";
import { legal, site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy notice",
  description:
    "How The Plain Theory handles personal data: what we collect and why, lawful bases, sub-processors, retention and your rights under GDPR, CCPA and the DPDP Act.",
  path: "/legal/privacy",
  kicker: "Legal",
});

const TOC = [
  { id: "who", label: "Who we are" },
  { id: "roles", label: "Our two roles" },
  { id: "collect", label: "What we collect" },
  { id: "visitors", label: "Data we process for customers" },
  { id: "purposes", label: "Purposes and lawful bases" },
  { id: "dpdp", label: "India: DPDP Act notice" },
  { id: "ccpa", label: "California: CCPA/CPRA" },
  { id: "sharing", label: "Sub-processors" },
  { id: "transfers", label: "International transfers" },
  { id: "retention", label: "How long we keep it" },
  { id: "security", label: "Security" },
  { id: "children", label: "Children" },
  { id: "rights", label: "Your rights" },
  { id: "changes", label: "Changes to this notice" },
  { id: "contact", label: "Contact and complaints" },
];

const privacyMail = <a href={`mailto:${site.privacyEmail}`}>{site.privacyEmail}</a>;

function GrievanceOfficer() {
  if (legal.grievanceOfficer) {
    const { name, email } = legal.grievanceOfficer;
    return (
      <>
        our Grievance Officer, {name}, at <a href={`mailto:${email}`}>{email}</a>
      </>
    );
  }
  return <>our Grievance Officer at {privacyMail}</>;
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" path="/legal/privacy" updated={{ iso: "2026-10-06", label: "6 October 2026" }} toc={TOC}>
      <p>
        This notice explains what personal data {site.legalName} collects, why we collect it, who we share it with, how long we
        keep it and what you can do about it. It covers our website, our dashboard and the data we process for our customers.
      </p>

      <h2 id="who">Who we are</h2>
      <p>
        {site.legalName} (&ldquo;Plain Theory&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a consent management platform: a
        script that websites use to ask visitors for consent and hold back trackers until they choose, and a dashboard where those
        websites configure the script and keep a record of each decision.
      </p>
      {legal.registeredOffice || legal.registrationNumber ? (
        <ul>
          {legal.registeredOffice ? <li>Registered office: {legal.registeredOffice}</li> : null}
          {legal.registrationNumber ? <li>Company registration number: {legal.registrationNumber}</li> : null}
        </ul>
      ) : null}
      <p>You can reach us about anything in this notice at {privacyMail}.</p>

      <h2 id="roles">Our two roles</h2>
      <p>We handle personal data in two different capacities, and different rules apply to each.</p>
      <ul>
        <li>
          <strong>We are the controller</strong> (the Data Fiduciary under India&apos;s DPDP Act) for data about people who visit
          our own website, contact us, or hold an account with us. We decide why and how that data is used, and this notice governs
          it.
        </li>
        <li>
          <strong>We are a processor</strong> (a Data Processor under the DPDP Act, and a service provider under the CCPA) for the
          consent records we keep on behalf of our customers about visitors to their websites. The website owner is the controller
          (or Data Fiduciary, or business) and decides how that data is used. Their privacy notice governs it, and our data
          processing addendum with them sets out what we may and may not do.
        </li>
      </ul>
      <p>
        If you visited a website that uses Plain Theory and want to ask about your consent record, contact that website first.
        We&apos;ll help them answer you.
      </p>

      <h2 id="collect">What we collect</h2>
      <p>This section covers the data we control. We collect only what we need for the purposes listed in the next sections.</p>

      <h3>Account data</h3>
      <ul>
        <li>your name and work email address;</li>
        <li>
          a password hash, never the password itself, or, if your organization signs in with Amazon Cognito, an identity managed
          there;
        </li>
        <li>multi-factor authentication settings: an encrypted authenticator secret and hashed recovery codes;</li>
        <li>your organization&apos;s name, its websites, the data region it chose, team members and their roles;</li>
        <li>the settings you make in the dashboard, such as banner text, categories and tracker rules.</li>
      </ul>

      <h3>Billing data</h3>
      <p>
        Payments are handled by Stripe. Stripe collects your card or other payment details directly; we never see or store full card
        numbers. We receive the billing details you give Stripe, such as your billing name, email, address and tax ID, along with
        the plan and currency you chose and the status of invoices and payments.
      </p>

      <h3>Sales enquiries and support</h3>
      <p>
        If you fill in the contact sales form, we collect your name, work email, company, how many websites you run, your monthly
        pageviews, the regions your visitors come from and your message. If you email us, we keep the email and our reply.
      </p>

      <h3>Security and usage logs</h3>
      <ul>
        <li>
          for each sign-in session: when it started and was last used, your browser&apos;s user agent, whether multi-factor
          authentication was completed, and a salted hash of your truncated IP address;
        </li>
        <li>
          an audit trail of administrative actions in your organization, such as sign-ins, failed sign-ins, password and MFA
          changes, invitations, role changes and published configurations;
        </li>
        <li>
          a salted hash of the truncated IP address of anyone who submits a form on our website, used only to limit abuse.
        </li>
      </ul>
      <p>
        We truncate IP addresses before hashing them and never store a full IP address. Our hosting provider processes IP addresses
        briefly to deliver pages and protect the service, as any web host does.
      </p>

      <h3>Visitors to our website</h3>
      <p>
        Our website does not use advertising cookies. To understand which pages are useful we use Vercel Web Analytics, which
        counts page views without cookies or any identifier that follows you across sites. It records the page path (we strip
        query strings first), the referring site, and your country, browser, operating system and device type, and reports them
        only in aggregate. Your IP address is used to derive the country and is not stored. Our site sets only the cookies and
        browser storage described in our <Link href="/legal/cookies">cookie policy</Link>.
      </p>

      <h2 id="visitors">Data we process for customers</h2>
      <p>
        When a visitor makes a consent choice on a customer&apos;s website, our script stores the choice in a first-party cookie and
        browser storage on that website, and sends a consent receipt to us. Each receipt records:
      </p>
      <ul>
        <li>the decision for each category (essential, functional, analytics, marketing), the action taken and the time;</li>
        <li>the version of the notice shown, the law it was shown under and the language it was shown in;</li>
        <li>a random visitor ID generated in the browser, not derived from any personal data;</li>
        <li>country, device type and browser family;</li>
        <li>a salted hash of the truncated IP address. The full IP address is never stored;</li>
        <li>whether a Global Privacy Control signal was present and honoured, and whether the browser was automated.</li>
      </ul>
      <p>
        Each receipt is linked to the one before it by a cryptographic hash, so the customer can prove the log hasn&apos;t been
        altered. Receipts are stored in the data region the customer chose: Mumbai or Hyderabad in India, Frankfurt in the EU, or
        N. Virginia in the US.
      </p>
      <p>
        We also keep, for the customer, reports of tracker requests seen after a visitor declined (page and tracker address with
        the query string removed, category and country), and logs of webhook deliveries to the customer&apos;s own systems.
      </p>
      <p>
        We use this data only to provide the service to that customer, on their documented instructions. We don&apos;t combine it
        with data from other customers, and we don&apos;t use it for our own purposes.
      </p>

      <h2 id="purposes">Purposes and lawful bases</h2>
      <p>
        Under the GDPR and UK GDPR we must have a lawful basis under Article 6 for each use of personal data. These are ours.
      </p>
      <LegalTable
        caption="Purposes and lawful bases for the data we control"
        head={["Purpose", "Data used", "Lawful basis (GDPR Art. 6)"]}
        rows={[
          ["Create and run your account", "Account data", "Contract (6(1)(b))"],
          ["Bill you and keep tax records", "Billing data", "Contract (6(1)(b)) and legal obligation (6(1)(c))"],
          [
            "Keep accounts and the service secure, prevent abuse and investigate incidents",
            "Security and usage logs, account data",
            "Legitimate interests (6(1)(f)) in a secure service",
          ],
          [
            "Measure which pages of our website are useful, in aggregate and without cookies",
            "Page path, referrer, country, browser, operating system and device type",
            "Legitimate interests (6(1)(f)) in improving our website",
          ],
          ["Answer sales enquiries and support requests", "Enquiry and support data", "Steps before a contract (6(1)(b)) or legitimate interests (6(1)(f))"],
          [
            "Tell you about changes that affect your account, such as security notices and changes to these terms",
            "Name and email",
            "Contract (6(1)(b)) and legitimate interests (6(1)(f))",
          ],
          ["Send product news, only if you ask for it", "Name and email", "Consent (6(1)(a)), which you can withdraw at any time"],
          ["Respond to lawful requests and enforce our terms", "Any of the above, as needed", "Legal obligation (6(1)(c)) or legitimate interests (6(1)(f))"],
        ]}
      />
      <p>
        Where we rely on legitimate interests, we have weighed them against your rights, and you can object at any time. We
        don&apos;t sell personal data, use it for advertising or make decisions about you by automated means that have legal or
        similarly significant effects.
      </p>

      <h2 id="dpdp">India: DPDP Act notice</h2>
      <p>
        If you are in India, this section is our notice under the Digital Personal Data Protection Act, 2023 and the Digital
        Personal Data Protection Rules, 2025, for data we hold as a Data Fiduciary.
      </p>
      <LegalTable
        caption="Personal data we process and why, under the DPDP Act"
        head={["Personal data", "Purpose"]}
        rows={[
          ["Name, work email, password hash, MFA settings", "Create your account, sign you in and keep it secure"],
          ["Organization name, websites, team members and roles", "Provide the dashboard and control who can see what"],
          ["Billing name, email, address, GSTIN if given, plan and invoices", "Bill you and meet tax and accounting law"],
          ["Session details, hashed truncated IP, audit trail", "Detect misuse, protect accounts and investigate incidents"],
          ["Enquiry and support messages", "Answer your enquiry or support request"],
        ]}
      />
      <ul>
        <li>
          <strong>Basis.</strong> We process this data for the purpose you provided it for, to meet legal obligations, or with your
          consent where we ask for it.
        </li>
        <li>
          <strong>Withdrawing consent.</strong> Where we rely on your consent, you can withdraw it as easily as you gave it, by
          using the unsubscribe link in the email or by writing to {privacyMail}. Withdrawal doesn&apos;t affect processing that
          already happened.
        </li>
        <li>
          <strong>Your rights.</strong> You can ask for a summary of the personal data we hold and how we use it, ask us to correct,
          complete, update or erase it, nominate another person to exercise your rights if you die or become unable to, and have a
          grievance addressed. Write to {privacyMail} and we&apos;ll reply within 30 days.
        </li>
        <li>
          <strong>Grievances.</strong> Contact <GrievanceOfficer />. We acknowledge grievances promptly and resolve them within 30
          days.
        </li>
        <li>
          <strong>Complaints to the Board.</strong> If you aren&apos;t satisfied with our response, you can complain to the Data
          Protection Board of India, through the channels it publishes.
        </li>
      </ul>
      <p>
        For consent records about visitors to our customers&apos; websites, the customer is the Data Fiduciary and you should
        contact them. Their notice should tell you how.
      </p>

      <h2 id="ccpa">California: CCPA/CPRA</h2>
      <p>If you are a California resident, the California Consumer Privacy Act, as amended by the CPRA, gives you these disclosures and rights.</p>
      <p>In the last 12 months we have collected these categories of personal information, from you directly and from your use of the service:</p>
      <ul>
        <li>identifiers, such as name, email address and the salted hash of a truncated IP address;</li>
        <li>customer records and commercial information, such as billing details, plan and invoice history;</li>
        <li>internet or other electronic network activity, such as sign-in sessions, browser user agent and audit events;</li>
        <li>professional information, such as your company and role;</li>
        <li>
          account login credentials, which are sensitive personal information. We use them only to sign you in and keep your
          account secure, not to infer anything about you.
        </li>
      </ul>
      <p>
        We use these for the business purposes listed under{" "}
        <a href="#purposes">purposes and lawful bases</a>, and disclose them only to the sub-processors listed below, for those
        purposes. <strong>We do not sell personal information, and we do not share it for cross-context behavioral advertising.</strong>{" "}
        We have not done so in the last 12 months, and we have no actual knowledge of selling or sharing data of anyone under 16.
      </p>
      <p>
        You have the right to know what we collect and how we use it, to delete it, to correct it, to opt out of sale or sharing,
        to limit the use of sensitive personal information, and not to be treated differently for exercising these rights. We honor
        the Global Privacy Control signal as a valid request to opt out of sale and sharing for the browser that sends it.
      </p>
      <p>
        To make a request, email {privacyMail}. We&apos;ll verify your request by matching it to your account email. You can use an
        authorized agent, who must show us your signed permission. We reply within 45 days, as the law requires, and aim for 30.
      </p>

      <h2 id="sharing">Sub-processors</h2>
      <p>We use a small number of service providers to run Plain Theory. Each is bound by a contract that limits how it may use the data.</p>
      <LegalTable
        caption="Sub-processors"
        head={["Provider", "What they do", "Data involved", "Location"]}
        rows={[
          [
            "Amazon Web Services",
            "Hosting, databases (DynamoDB), file storage (S3), content delivery (CloudFront) and optional sign-in (Cognito)",
            "All account data, and customers' consent records",
            "The region each customer chooses: Mumbai, Hyderabad, Frankfurt or N. Virginia. The script is delivered from CloudFront edge locations worldwide.",
          ],
          ["Stripe", "Payments, invoices and subscription management", "Billing data", "United States and other Stripe locations"],
          [
            "Vercel",
            "Website hosting and cookieless page-view analytics for our marketing site",
            "Website visitors' page paths, referrer, country and device type; IP addresses briefly, to serve pages",
            "United States, with edge locations worldwide",
          ],
          ["Our email provider", "Account, security, billing and support emails", "Name and email address", "Varies by provider"],
          ["Our team messaging tool", "Alerts our team to new sales enquiries", "Sales enquiry details", "Varies by provider"],
        ]}
      />
      <p>
        We tell customers at least 30 days before adding or replacing a sub-processor that handles their visitors&apos; data, so they
        can object. We may also disclose data where the law requires it, to protect our rights or users&apos; safety, or to a buyer
        if our business is sold, in which case this notice will continue to apply.
      </p>

      <h2 id="transfers">International transfers</h2>
      <p>
        Customers&apos; consent records stay in the data region the customer chooses. Account and billing data may be processed in
        India, the European Union and the United States by us and our sub-processors.
      </p>
      <p>
        When we transfer personal data from the EEA, the UK or Switzerland to a country without an adequacy decision, we use the
        European Commission&apos;s Standard Contractual Clauses, with the UK Addendum where UK data is involved, together with
        additional safeguards such as encryption. Transfers of data from India follow the DPDP Act and any restrictions the
        Government of India notifies. You can ask for a copy of the relevant safeguards at {privacyMail}.
      </p>

      <h2 id="retention">How long we keep it</h2>
      <p>We keep personal data only as long as we need it, then delete it. A daily job removes data that has passed its period.</p>
      <LegalTable
        caption="Retention periods"
        head={["Data", "How long we keep it"]}
        rows={[
          ["Account data", "While your account is open, then deleted within 30 days of closure"],
          ["After cancellation", "Read-only access for 30 days so you can export your data, then deletion"],
          ["Invoices and billing records", "For the period tax and accounting law requires"],
          ["Session records", "30 days after the session ends"],
          ["Administrative audit trail", "For the life of your organization's account, then deleted with it"],
          ["Sales enquiries and support emails", "As long as we need them to respond and follow up, then deleted"],
          ["Customers' consent receipts: Free plan", "90 days"],
          ["Customers' consent receipts: Starter plan", "1 year"],
          ["Customers' consent receipts: Growth plan", "2 years"],
          ["Customers' consent receipts: Business plan", "7 years"],
          ["Customers' consent receipts: Enterprise plan", "10 years, or as agreed"],
          ["Leak reports", "90 days"],
          ["Webhook delivery logs", "30 days"],
          ["Backups", "Roll off within 35 days"],
        ]}
      />
      <p>
        When consent receipts are removed by the retention job, we keep a checkpoint (a hash and a count, with no personal data) so
        the remaining log can still be verified. We may keep data longer where the law requires it or to deal with a legal claim.
      </p>

      <h2 id="security">Security</h2>
      <p>We protect personal data with measures that fit the risk, including:</p>
      <ul>
        <li>encryption in transit (TLS) and at rest;</li>
        <li>IP addresses truncated and salted-hashed before storage, never kept in full;</li>
        <li>a hash-chained consent log that shows if any record was changed or removed;</li>
        <li>multi-factor authentication, sessions that expire after 30 minutes idle and 12 hours in total, and account lockout after repeated failed sign-ins;</li>
        <li>role-based access for customer teams, and a tamper-evident audit trail of administrative actions;</li>
        <li>access to production data limited to staff who need it.</li>
      </ul>
      <p>
        If a personal data breach affects you, we&apos;ll tell you and the relevant authorities as the law requires. For customer
        data, we notify the customer without undue delay so they can meet their own obligations. Read more on our{" "}
        <Link href="/security">security page</Link>.
      </p>

      <h2 id="children">Children</h2>
      <p>
        Plain Theory is a business service. It isn&apos;t directed at children and we don&apos;t knowingly collect personal data
        from anyone under 18 for our own purposes. If you believe a child has given us personal data, contact {privacyMail} and
        we&apos;ll delete it. Customers whose websites are used by children are responsible for obtaining verifiable parental
        consent where the law requires it.
      </p>

      <h2 id="rights">Your rights</h2>
      <p>Depending on where you live, you can ask us to:</p>
      <ul>
        <li>give you access to, or a copy of, the personal data we hold about you;</li>
        <li>correct, complete or update it;</li>
        <li>erase it;</li>
        <li>restrict how we use it, or object to our use of it based on legitimate interests;</li>
        <li>give it to you, or another provider, in a machine-readable format;</li>
        <li>withdraw consent you have given, without affecting earlier processing;</li>
        <li>nominate someone to exercise your rights for you, under the DPDP Act.</li>
      </ul>
      <p>
        To exercise any right, email {privacyMail} from the address linked to your account, or tell us how to verify who you are.
        We reply within 30 days. If a request is complex we may extend that where the law allows, and we&apos;ll tell you why. We
        don&apos;t charge for requests unless they are clearly unfounded or excessive.
      </p>
      <p>
        Many of these you can do yourself: update your details in account settings, export consent logs from the dashboard, and
        cancel your plan from the Billing page. To have your account deleted, email us.
      </p>

      <h2 id="changes">Changes to this notice</h2>
      <p>
        We update this notice when our practices change. The date at the top shows when it last changed. If a change materially
        affects how we use your data, we&apos;ll email account owners at least 30 days before it takes effect.
      </p>

      <h2 id="contact">Contact and complaints</h2>
      <ul>
        <li>Privacy questions and requests: {privacyMail}</li>
        <li>
          Grievances under the DPDP Act: <GrievanceOfficer />
        </li>
        {legal.registeredOffice ? <li>Post: {site.legalName}, {legal.registeredOffice}</li> : null}
      </ul>
      <p>
        If you&apos;re unhappy with our answer, you can complain to a data protection authority: the Data Protection Board of India,
        the supervisory authority in your EU country, the UK Information Commissioner&apos;s Office, or the California Privacy
        Protection Agency. We&apos;d appreciate the chance to put things right first.
      </p>
    </LegalPage>
  );
}
