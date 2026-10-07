import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal/legal-page";
import { LegalTable } from "@/components/marketing/legal/legal-table";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Cookie policy",
  description:
    "Cookies and storage used by the Plain Theory website and dashboard, why each exists and how long it lasts. No advertising cookies and no tracking cookies.",
  path: "/legal/cookies",
  kicker: "Legal",
});

const TOC = [
  { id: "summary", label: "In short" },
  { id: "what", label: "What cookies are" },
  { id: "website", label: "On our website" },
  { id: "dashboard", label: "In the dashboard" },
  { id: "not-used", label: "What we don't use" },
  { id: "choices", label: "Your choices" },
  { id: "customer-sites", label: "On our customers' sites" },
  { id: "changes", label: "Changes and contact" },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie policy" path="/legal/cookies" updated={{ iso: "2026-10-06", label: "6 October 2026" }} toc={TOC}>
      <h2 id="summary">In short</h2>
      <p>
        We use a handful of first-party cookies and browser storage entries to sign you in, keep your account secure and remember
        a few settings. We don&apos;t use advertising cookies, our page-view analytics and page-speed measurement (Vercel Web Analytics and Speed Insights) work without cookies,
        and nothing on our site tracks you across other websites.
      </p>

      <h2 id="what">What cookies are</h2>
      <p>
        A cookie is a small text file a website stores in your browser. Local storage is a similar feature that keeps data in your
        browser but isn&apos;t sent to the server with each request. This policy covers both, and we call them &ldquo;cookies&rdquo;
        for short. All of ours are first-party: they are set by our own domain and only our own site can read them.
      </p>

      <h2 id="website">On our website</h2>
      <p>These apply to anyone visiting our public website, including the demo store.</p>
      <LegalTable
        caption="Cookies and storage on our website"
        head={["Name", "Purpose", "Type", "Duration"]}
        rows={[
          [
            <code key="n">plain_consent</code>,
            "Remembers the cookie choices you make on our site, so we don't ask again on every page. Stored as a cookie and mirrored in local storage.",
            "Essential",
            "180 days, or until you change your choice",
          ],
          [
            <code key="n">pt-announcement-dpdp-2027</code>,
            "Remembers that you closed the announcement bar at the top of the page. Local storage only, never sent to us.",
            "Functional",
            "Until you clear your browser storage",
          ],
        ]}
      />

      <h2 id="dashboard">In the dashboard</h2>
      <p>These are set only when you sign in to your Plain Theory account.</p>
      <LegalTable
        caption="Cookies in the dashboard"
        head={["Name", "Purpose", "Type", "Duration"]}
        rows={[
          [
            <code key="n">pt_session</code>,
            "Keeps you signed in. Holds a signed reference to your session, not your password. Not readable by scripts on the page.",
            "Essential",
            "30 minutes of inactivity, renewed while you use the dashboard, and never more than 12 hours",
          ],
          [
            <code key="n">pt_mfa</code>,
            "Proves you passed the password step while you enter your multi-factor authentication code. Not readable by scripts on the page.",
            "Essential",
            "5 minutes, and removed once you finish signing in",
          ],
          [
            <code key="n">pt-sidebar</code>,
            "Remembers whether you collapsed the dashboard sidebar.",
            "Functional",
            "1 year",
          ],
        ]}
      />
      <p>
        Essential cookies are needed for the service to work and to keep your account secure, so they don&apos;t need your consent.
        Functional entries only remember a display preference and contain no personal data.
      </p>

      <h2 id="not-used">What we don&apos;t use</h2>
      <ul>
        <li>no advertising or retargeting cookies, and no social media pixels;</li>
        <li>no analytics cookies: Vercel Web Analytics counts page views and Vercel Speed Insights measures page speed, both without cookies or identifiers, and we use no session recording;</li>
        <li>no cookies that track you across other websites;</li>
        <li>no third-party cookies of any kind.</li>
      </ul>
      <p>
        If we ever add a non-essential cookie, we&apos;ll list it here first and ask for your consent before setting it.
      </p>

      <h2 id="choices">Your choices</h2>
      <ul>
        <li>
          <strong>Cookie settings.</strong> Use <strong>Cookie settings in the footer</strong> of any page to review or change
          your choices at any time. Withdrawing consent is as easy as giving it.
        </li>
        <li>
          <strong>Global Privacy Control.</strong> If your browser sends a Global Privacy Control signal, we honor it as an opt-out
          of any sale or sharing of your data, and of marketing cookies, without you having to do anything else.
        </li>
        <li>
          <strong>Your browser.</strong> You can block or delete cookies and local storage in your browser&apos;s settings. If you
          block essential cookies, you won&apos;t be able to sign in to the dashboard.
        </li>
      </ul>

      <h2 id="customer-sites">On our customers&apos; sites</h2>
      <p>
        Websites that use Plain Theory set the <code>plain_consent</code> cookie and local storage entry on their own domain to
        remember the choice you made in their banner. That website, not us, decides which cookies it uses and for how long it
        remembers your choice, and its own cookie policy explains them. To change your choice there, use the privacy choices link
        on that website.
      </p>

      <h2 id="changes">Changes and contact</h2>
      <p>
        We update this policy whenever the cookies we use change, and the date at the top shows when it last changed. For more
        on how we handle personal data, read our <Link href="/legal/privacy">privacy notice</Link>. Questions go to{" "}
        <a href={`mailto:${site.privacyEmail}`}>{site.privacyEmail}</a>.
      </p>
    </LegalPage>
  );
}
