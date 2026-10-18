import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import type { ReactNode } from "react";
import { CodeBlock, CodeTabs } from "@/components/marketing/docs/code-block";
import { API, INSTALL_SNIPPETS, KEY, PACKAGES_ON_NPM, PACKAGE_SNIPPETS } from "@/components/marketing/docs/framework-snippets";
import { PageHero } from "@/components/marketing/page-hero";
import { Toc, type TocItem } from "@/components/marketing/toc";

export const metadata = pageMetadata({
  title: "Install Docs: Next.js, React, WordPress",
  description:
    "Add the consent script with one tag in HTML, Next.js, React, Vue, WordPress and more, then set up banners, regions, Consent Mode v2, webhooks and the JavaScript and REST APIs.",
  path: "/docs",
  socialTitle: "Install in one line, then configure",
});

const TOC: TocItem[] = [
  { id: "setup", label: "Set up a site" },
  { id: "install", label: "Install" },
  { id: "frameworks", label: "Frameworks" },
  { id: "wordpress", label: "WordPress" },
  { id: "blocking", label: "Block trackers" },
  { id: "banner", label: "Banner and copy" },
  { id: "regions", label: "Regions and languages" },
  { id: "consent-mode", label: "Google Consent Mode" },
  { id: "api", label: "JavaScript API" },
  { id: "headless", label: "Headless mode" },
  { id: "scanner", label: "Scanner" },
  { id: "leaks", label: "Leak detection" },
  { id: "analytics", label: "Analytics and records" },
  { id: "webhooks", label: "Webhooks" },
  { id: "rest-api", label: "REST API" },
  { id: "team", label: "Team and sign-in" },
];

const LINK = "font-medium text-ink underline underline-offset-4";

function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t border-line pt-12 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="text-[1.75rem] font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-ink-2 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:bg-paper [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[13px] [&_code:not(pre_code)]:text-ink">
        {children}
      </div>
    </section>
  );
}

/** A heading inside a section, for reference blocks that need their own label. */
function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-lg font-semibold tracking-tight text-ink">{children}</h3>;
}

/** Reference table. Below 640px each row stacks (name and type, then the description) instead of clipping columns. */
function Params({ caption, rows, head = ["Name", "Type"] }: { caption: string; rows: [name: string, type: string, description: string][]; head?: [string, string] }) {
  return (
    <>
      <dl aria-label={caption} className="divide-y divide-line rounded-[var(--radius-md)] border border-line sm:hidden">
        {rows.map(([n, t, d]) => (
          <div key={n} className="px-4 py-3.5">
            <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[13px] text-ink [overflow-wrap:anywhere]">{n}</span>
              <span className="font-mono text-xs text-ink-3">
                <span className="sr-only">{head[1]}: </span>
                {t}
              </span>
            </dt>
            <dd className="mt-1 text-sm text-ink-2">{d}</dd>
          </div>
        ))}
      </dl>
      <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-line sm:block" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-paper text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {head[0]}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {head[1]}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([n, t, d]) => (
            <tr key={n}>
              <th scope="row" className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-normal text-ink">
                {n}
              </th>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-ink-3">{t}</td>
              <td className="px-4 py-3 text-ink-2">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

/* ---------- code samples ---------- */

const RECEIPT_JSON = `{
    "id": "rcpt_…",
    "seq": 1284,
    "hash": "9f2c…64 hex characters",
    "visitorId": "3f9c0a1e7b2d4c6e8f00112233445566",
    "action": "custom",
    "framework": "gdpr",
    "categories": { "essential": true, "functional": true, "analytics": false, "marketing": false },
    "country": "DE",
    "gpc": false,
    "timestamp": "2026-10-18T09:41:07.512Z"
  }`;

const WEBHOOK_PAYLOADS = `// consent.created: every new decision
{
  "event": "consent.created",
  "siteKey": "${KEY}",
  "receipt": ${RECEIPT_JSON}
}

// consent.withdrawn: the categories this visitor turned off, with the same receipt
{
  "event": "consent.withdrawn",
  "siteKey": "${KEY}",
  "withdrawn": ["analytics", "marketing"],
  "receipt": { … }
}

// leak.detected: a tracker request made after its category was declined
{
  "event": "leak.detected",
  "siteKey": "${KEY}",
  "leak": {
    "id": "leak_…",
    "url": "https://connect.facebook.net/en_US/fbevents.js",
    "category": "marketing",
    "page": "/checkout",
    "framework": "gdpr",
    "country": "DE",
    "createdAt": "2026-10-18T09:41:07.512Z"
  }
}`;

const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

// header: "t=1760000000,v1=<hex>"   rawBody: the request body exactly as received, before JSON.parse
export function verifyPlainSignature(secret, header, rawBody, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=")));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Next.js route handler (app/api/plain-webhook/route.js)
export async function POST(req) {
  const rawBody = await req.text();
  const ok = verifyPlainSignature(process.env.PLAIN_WEBHOOK_SECRET, req.headers.get("x-plain-signature"), rawBody);
  if (!ok) return new Response("bad signature", { status: 401 });

  const event = JSON.parse(rawBody);
  // X-Plain-Delivery stays the same across retries: skip ids you have already handled.
  if (event.event === "consent.withdrawn") {
    // stop processing event.receipt.visitorId for event.withdrawn
  }
  return new Response("ok");
}`;

const CONSENT_BODY = `{
  "siteKey": "${KEY}",
  "visitorId": "3f9c0a1e7b2d4c6e8f00112233445566",
  "action": "custom",
  "framework": "gdpr",
  "categories": { "essential": true, "functional": true, "analytics": false, "marketing": false },
  "configVersion": 4,
  "gpc": false,
  "automated": false,
  "language": "en"
}`;

const ERROR_BODY = `{
  "error": {
    "code": "invalid_body",
    "message": "Some fields are missing or invalid.",
    "fields": { "visitorId": ["Visitor id must be 16 to 64 hex characters."] }
  }
}`;

export default function DocsPage() {
  return (
    <>
      <PageHero
        tone="paper"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Developers", href: "/docs" },
        ]}
        title="Developer documentation"
        lead="One script tag holds trackers, shows the right notice and records each decision. Everything else is optional."
        meta="SDK version 1.0.0."
      />

      <div className="bg-surface">
        <div className="container-page grid gap-12 py-16 md:py-20 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-28">
              <Toc items={TOC} label="Contents" />
            </div>
          </aside>

          <article className="min-w-0 space-y-16 lg:col-span-9 lg:max-w-[780px] lg:pl-8">
            <DocSection id="setup" title="Set up a site">
              <p>
                <Link href="/auth/signup" className={LINK}>
                  Create an account
                </Link>{" "}
                and add your site&apos;s domain. The site&apos;s Overview page then shows a setup checklist; each step ticks itself off
                from what has actually happened, never from a box you tick.
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  <strong className="font-semibold text-ink">Scan your site.</strong> The{" "}
                  <a href="#scanner" className={LINK}>
                    Scanner
                  </a>{" "}
                  visits it as a first-time visitor and lists what it sets.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Review the cookies found.</strong> Confirm each one&apos;s category in the
                  Cookie catalog. Anything outside Essential is held until the visitor allows its category.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Design your banner</strong> in Banner studio.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Publish the banner.</strong> Visitors only ever see a published version.
                  Publishing is blocked while a fairness check fails.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Add the script to your site</strong> from the Install page. This step
                  completes when the banner loads on your site for the first time.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Record the first consent.</strong> Open your site in a private window and
                  choose on the banner. The choice appears in the Consent log.
                </li>
              </ol>
              <p>Where things live in the dashboard:</p>
              <Params
                caption="Dashboard sections"
                head={["Section", "Group"]}
                rows={[
                  ["Overview", "Site", "Setup checklist, consent analytics and site status."],
                  ["Scanner, Cookie catalog, Banner studio, Regions, Languages, Install", "Set up", "Everything that decides what visitors see and what is held."],
                  ["Leaks, DPDP readiness", "Monitor", "Trackers that fired without consent, and a readiness check against the DPDP Act."],
                  ["Consent log, Evidence Pack", "Records", "Every receipt, and an auditor-ready summary of the site's consent."],
                  ["Webhooks, Site settings", "Site", "Signed events to your own systems, and the site's domain and details."],
                  ["Sites, Team, Billing, Settings, Audit log, Security controls", "Organization", "Shared by every site in the organization."],
                ]}
              />
            </DocSection>

            <DocSection id="install" title="Install">
              <p>
                Add the script as the <strong className="font-semibold text-ink">first script in your page&apos;s head</strong>. Copy
                it from your site&apos;s Install page, where it already carries your site key. Scripts parsed before it can&apos;t be
                held, so order matters.
              </p>
              <CodeTabs tabs={INSTALL_SNIPPETS} />
              <p>
                Using a framework? The same tag works in every one, and it&apos;s the only way to hold trackers written into your HTML.
                See{" "}
                <a href="#frameworks" className={LINK}>
                  Frameworks
                </a>{" "}
                for reading consent from your own code.
              </p>
              <p>The script reads these attributes from its own tag:</p>
              <Params
                caption="Script tag attributes"
                rows={[
                  ["data-site", "string", "Your public site key. Required. Safe to ship in HTML."],
                  ["data-api", "URL", `The consent API, ${API}. Keep it: without it the script uses its own origin + /api/v1, which is the CDN, not the API.`],
                  ["data-config-url", "URL", "Where to fetch the published config. The Install page adds it when your config is served from the CDN; otherwise it defaults to {data-api}/config/{site key}."],
                  ["data-gcm", "flag", "Google Consent Mode is on: the script sends Consent Mode defaults before its config arrives. The Install page adds it when Consent Mode is on. \"false\" turns early defaults off."],
                  ["data-debug", "flag", "Allows ?plain_country= and ?plain_region= to override location for testing. Always on for localhost."],
                ]}
              />
              <p>
                Then check it from the Install page: <strong className="font-semibold text-ink">Check installation</strong> reads your
                live homepage and says whether the script is there, or whether another consent tool is on the page instead. The page
                also turns to Connected by itself the first time the banner loads or a choice is recorded.
              </p>
            </DocSection>

            <DocSection id="frameworks" title="Frameworks">
              <p>
                Plain Theory works with React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular and any other stack that renders HTML. Add
                the script tag from{" "}
                <a href="#install" className={LINK}>
                  Install
                </a>
                , then read and change consent from your components with the{" "}
                <a href="#api" className={LINK}>
                  JavaScript API
                </a>
                .{PACKAGES_ON_NPM ? " Or use a typed package for your framework (below)." : " Nothing to install from npm."}
              </p>
              <CodeBlock
                title="React: read consent in a component"
                language="jsx"
                code={`import { useEffect, useState } from "react";

// true once the visitor allows analytics
export function useAnalyticsAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const update = (e) => setAllowed(!!e.detail.categories.analytics);
    window.addEventListener("plainconsent:change", update);
    window.PlainConsent = window.PlainConsent || [];
    window.PlainConsent.push((pc) => setAllowed(!!pc.get().categories.analytics));
    return () => window.removeEventListener("plainconsent:change", update);
  }, []);
  return allowed;
}`}
              />
              <p>
                Categories are <code>essential</code> (always allowed), <code>functional</code>, <code>analytics</code> and{" "}
                <code>marketing</code>. A script that has already run can&apos;t be unloaded, so a later withdrawal takes effect from the
                next page view.
              </p>
              {PACKAGES_ON_NPM ? (
                <>
                  <h3 className="pt-2 text-base font-semibold text-ink">Framework packages</h3>
                  <p>
                    Typed packages wrap the same script with hooks, stores and components. Keep the script tag in <code>&lt;head&gt;</code>{" "}
                    (it holds trackers in your HTML); the packages detect it and never load a second copy. Without the tag, they load
                    the script themselves. Consent is <code>null</code> during server rendering and until the script is ready, so
                    nothing that needs consent renders early.
                  </p>
                  <CodeTabs tabs={PACKAGE_SNIPPETS} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-ink-3">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Package</th>
                          <th className="py-2 font-medium">What you get</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {[
                          ["@theplaintheory/react", "PlainConsentProvider, useConsent, useConsentAllowed, useConsentReady, ConsentGate, ConsentScript, PrivacyChoicesButton"],
                          ["@theplaintheory/vue", "createPlainConsent plugin, useConsent, ConsentGate, ConsentScript, PrivacyChoicesButton"],
                          ["@theplaintheory/svelte", "init, consent / ready / allowed(category) stores, consentScript action, actions"],
                          ["@theplaintheory/angular", "providePlainConsent, PlainConsentService (signals), *plainConsentAllowed"],
                          ["@theplaintheory/consent", "Any framework: loadPlainConsent, isAllowed, onConsentChange, whenAllowed, loadScriptWhenAllowed"],
                        ].map(([name, what]) => (
                          <tr key={name}>
                            <td className="py-2 pr-4 align-top">
                              <code>{name}</code>
                            </td>
                            <td className="py-2">{what}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </DocSection>

            <DocSection id="wordpress" title="WordPress">
              <p>
                Works with WordPress: paste the script into your theme header or a header-code plugin. Banner design, regions and
                languages stay in the dashboard.
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Paste the tag from{" "}
                  <a href="#install" className={LINK}>
                    Install
                  </a>{" "}
                  right after <code>&lt;head&gt;</code> in your theme&apos;s <code>header.php</code>. Use a child theme so theme updates
                  don&apos;t remove it.
                </li>
                <li>
                  Or use a header-code plugin such as WPCode: add a snippet, choose <strong>Site wide header</strong> and give it the
                  highest priority, so it loads before other scripts.
                </li>
                <li>
                  To hold a script another plugin adds, mark it as described in{" "}
                  <a href="#blocking" className={LINK}>
                    Block trackers
                  </a>
                  . Known trackers are held automatically.
                </li>
              </ol>
            </DocSection>

            <DocSection id="blocking" title="Block trackers">
              <p>
                Change the <code>type</code> of any script that needs consent to <code>text/plain</code> and name its category in{" "}
                <code>data-consent</code>. It stays inert until the visitor allows that category, then runs once. For a module script,
                add <code>data-type=&quot;module&quot;</code> and it runs with that type.
              </p>
              <CodeBlock
                title="Static blocking"
                language="html"
                code={`<script type="text/plain" data-consent="analytics"\n        src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>\n\n<script type="text/plain" data-consent="marketing">\n  fbq('init', '000000000000');\n</script>\n\n<!-- an embed: the address goes in data-plain-src and loads once marketing is allowed -->\n<iframe data-consent="marketing" data-plain-src="https://www.youtube.com/embed/VIDEO_ID"></iframe>`}
              />
              <p>
                Scripts and iframes added later are held automatically when their <code>src</code> matches a known tracker or an
                approved entry in your Cookie catalog, under that entry&apos;s category. Google Analytics, Hotjar, Microsoft Clarity,
                Meta Pixel, LinkedIn Insight, TikTok Pixel and Google Ads are recognised before your config even loads. Google Tag
                Manager itself is never held; the trackers it adds are. Categories are <code>functional</code>,{" "}
                <code>analytics</code> and <code>marketing</code>; <code>essential</code> is never blocked.
              </p>
              <p>
                The choice is stored first-party in a <code>plain_consent</code> cookie, mirrored to <code>localStorage</code>, for
                the consent lifetime you set (180 days by default).
              </p>
            </DocSection>

            <DocSection id="banner" title="Banner and copy">
              <p>
                Design the banner in Banner studio: layout (bar, modal, corner toast or pill), position, colours, corner radius, font
                (system, your site&apos;s own, serif or mono), the side of the Privacy choices button and the copy. Accept and reject
                are equal weight by default. Extra CSS, up to 4,000 characters, styles the banner only; anything that loads a resource
                or runs code (<code>@import</code>, <code>url()</code> and the like) is refused.
              </p>
              <p>
                Publishing creates a new config version. Visitors whose choice was made against an older version are asked again, so
                publish for changes that matter to them. A fairness check runs before every publish, covering contrast, an easy
                Reject and each law&apos;s required notice details, and publishing waits until every failing check is fixed. After
                &quot;Reject all&quot;, a visitor isn&apos;t asked again for 180 days by default unless you publish a new version.
              </p>
              <p>
                The banner renders in a closed shadow root, so your CSS can&apos;t break it and it can&apos;t restyle your page. It&apos;s a
                labelled region for the bar, toast and pill layouts and a modal dialog with a focus trap for the modal layout and the
                preferences panel. After a choice, a Privacy choices button on every page reopens the preferences.
              </p>
            </DocSection>

            <DocSection id="regions" title="Regions and languages">
              <p>
                The config response carries the visitor&apos;s country in <code>x-plain-country</code> (and state in{" "}
                <code>x-plain-region</code>), set at the edge from the visitor&apos;s network location. The script picks a notice from
                it:
              </p>
              <Params
                caption="Location to notice mapping"
                head={["Visitors from", "Notice"]}
                rows={[
                  ["EU, EEA, UK, Switzerland", "gdpr", "Opt-in by default. Nothing non-essential runs until the visitor accepts."],
                  ["California (US-CA)", "ccpa", "Opt-out by default. Trackers start on; reject switches them off. Global Privacy Control keeps marketing off."],
                  ["Where the DPDP Act applies", "dpdpa", "Opt-in by default, with your Data Protection Officer's contact details in the preferences panel."],
                  ["Everywhere else", "generic", "Your default notice. Visitors fall back here when their region is turned off."],
                ]}
              />
              <p>
                On the Regions page you can turn each notice on or off, switch it between opt-in and opt-out and edit its wording.
                Test locally with <code>?plain_country=DE</code> or <code>?plain_country=US&amp;plain_region=CA</code>; the override
                works on localhost, or anywhere the tag has <code>data-debug</code>.
              </p>
              <p>
                Add translations of each notice on the Languages page. The script shows the one that matches the page&apos;s{" "}
                <code>&lt;html lang&gt;</code>, then the browser&apos;s languages, and falls back to the notice&apos;s own language.
                Visitors can switch language in the banner, and you can call <code>PlainConsent.setLanguage(&quot;fr&quot;)</code>{" "}
                from your own language switcher. The language shown is recorded on each receipt.
              </p>
            </DocSection>

            <DocSection id="consent-mode" title="Google Consent Mode v2">
              <p>
                Consent Mode is on by default (Banner studio turns it off). With it on, the script defines a <code>gtag</code> shim,
                sends a <code>default</code> signal (with <code>wait_for_update: 500</code>) and then an <code>update</code> whenever
                the choice changes. Load Google tags normally; they read the signals.
              </p>
              <p>
                The defaults must reach the data layer before Google tags run, which can be before the config arrives. With{" "}
                <code>data-gcm</code> on the tag they go out immediately. Without it, the script uses what this browser saw last
                time, and on a first visit it holds gtag.js, Google Analytics and Google Ads until the config has arrived and the
                defaults are sent.
              </p>
              <Params
                caption="Consent Mode signals"
                head={["Signal", "Category"]}
                rows={[
                  ["ad_storage, ad_user_data, ad_personalization", "marketing", "Granted when marketing is allowed."],
                  ["analytics_storage", "analytics", "Granted when analytics is allowed."],
                  ["functionality_storage, personalization_storage", "functional", "Granted when functional is allowed."],
                  ["security_storage", "always", "Always granted."],
                ]}
              />
            </DocSection>

            <DocSection id="api" title="JavaScript API">
              <p>
                <code>window.PlainConsent</code> is available as soon as the script runs. To call it before then, push a function onto
                an array; the queue runs when the script loads. After that, <code>push</code> runs the function straight away.
              </p>
              <CodeBlock
                title="Reading and changing consent"
                language="js"
                code={`window.PlainConsent = window.PlainConsent || [];\nPlainConsent.push((pc) => {\n  pc.on("ready", (state) => console.log(state.framework, state.categories));\n});\n\n// later, from your own settings page\nPlainConsent.set({ analytics: true, marketing: false });\nPlainConsent.open();   // show the preferences panel\nPlainConsent.revoke(); // withdraw: forget the choice and ask again`}
              />
              <Params
                caption="PlainConsent methods"
                head={["Method", "Returns"]}
                rows={[
                  ["get()", "ConsentState", "{ framework, categories, decided, visitorId, language } for this visitor."],
                  ["acceptAll()", "void", "Grant every category and log an accept_all receipt."],
                  ["rejectAll()", "void", "Keep only essential and log a reject_all receipt."],
                  ["set(partial)", "void", "Merge category changes, e.g. { analytics: true }, and log a custom receipt."],
                  ["open()", "void", "Show the preferences panel."],
                  ["revoke()", "void", "Clear the stored choice, turn every optional category off, log a revoke receipt and show the banner again."],
                  ["setLanguage(code)", "void", "Show the notice in a translation you added, e.g. \"fr\". \"\" returns to the default."],
                  ["on(event, fn)", "() => void", "Listen for 'ready' (config loaded; fires at once if it already has) or 'change'. Returns an unsubscribe function."],
                  ["push(fn)", "void", "Run fn with the API, now or once the script has loaded."],
                  ["version", "string", "The SDK version, \"1.0.0\"."],
                ]}
              />
              <p>
                Every change also fires a <code>plainconsent:change</code> event on <code>window</code> with the state in{" "}
                <code>event.detail</code>, for code that can&apos;t hold a reference to the API. <code>framework</code> is one of{" "}
                <code>gdpr</code>, <code>ccpa</code>, <code>dpdpa</code> or <code>generic</code>. Receipts are logged only once the
                config has loaded, so call these methods from a <code>ready</code> listener or later.
              </p>
              <p>
                Want consent changes in your own servers instead? See{" "}
                <a href="#webhooks" className={LINK}>
                  Webhooks
                </a>
                .
              </p>
            </DocSection>

            <DocSection id="headless" title="Headless mode">
              <p>
                Turn on headless mode in Banner studio and the script renders nothing. Blocking, storage, Google Consent Mode and
                receipts all keep working; you draw the interface and call the API.
              </p>
              <CodeBlock
                title="Your own banner"
                language="js"
                code={`PlainConsent.push((pc) => {\n  pc.on("ready", ({ decided }) => {\n    if (!decided) myBanner.show();\n  });\n  myBanner.onAccept = () => pc.acceptAll();\n  myBanner.onReject = () => pc.rejectAll();\n});`}
              />
            </DocSection>

            <DocSection id="scanner" title="Scanner">
              <p>
                The Scanner opens your site in a real browser as a first-time visitor and records every cookie, storage key, script,
                embed and tracking pixel it meets, starting from the homepage. You choose how many pages to visit (up to 100) and how
                deep to follow links (up to 4). It flags non-essential trackers that are set before anyone has consented, and you can
                schedule it to run weekly or monthly.
              </p>
              <p>
                Findings are matched against known trackers and sorted into categories, then go to the Cookie catalog for review;
                only entries you approve reach visitors&apos; browsers. The scanner honours <code>robots.txt</code>, only fetches
                public <code>http(s)</code> addresses and refuses private and internal networks.
              </p>
            </DocSection>

            <DocSection id="leaks" title="Leak detection">
              <p>
                With leak detection on (the default), the script watches for requests to known trackers and those in your Cookie
                catalog whose category the visitor hasn&apos;t allowed: before a choice in opt-in regions, or after a decline. It reports at most five
                per page view, with the query string removed and identifier-like parts of the page path replaced. Reports appear on
                the Leaks page and can be sent as{" "}
                <a href="#webhooks" className={LINK}>
                  webhooks
                </a>
                . A leak usually means a script was added outside the script tag&apos;s reach; hold it as shown in{" "}
                <a href="#blocking" className={LINK}>
                  Block trackers
                </a>
                .
              </p>
            </DocSection>

            <DocSection id="analytics" title="Analytics and records">
              <p>
                A site&apos;s Overview page shows opt-in, opt-out and partial consent rates and banner bounce rate by day, decisions
                per day, consent by category, and where decisions come from by country, legal framework, device and browser. Days
                are UTC. Impressions come from a <code>view</code> event when the banner shows; a <code>bounce</code> is sent when
                someone leaves without choosing. The opt-in chart has a table view.
              </p>
              <p>
                Every decision is written as a receipt in a hash chain: each receipt&apos;s hash covers the one before it, so an edited
                or deleted receipt breaks the chain. The Consent log lists receipts and verifies any one of them. The Evidence Pack,
                on the Growth plan and above, gathers the site&apos;s configuration, fairness checks, chain verification and daily
                anchors in one tamper-evident document for an auditor.
              </p>
            </DocSection>

            <DocSection id="webhooks" title="Webhooks">
              <p>
                Webhooks send signed JSON to your own servers when consent changes, so a withdrawal is honoured in your CRM, CDP and
                warehouse too. They are on the Business and Enterprise plans. Add up to 10 per site on the site&apos;s Webhooks page:
                an <code>https</code> URL on a public address (no credentials in the URL) and the events to send. The signing secret
                is shown once, when you add the webhook. You can pause, resume, delete and send a test delivery from the same page.
              </p>
              <Params
                caption="Webhook events"
                head={["Event", "Sent when"]}
                rows={[
                  ["consent.created", "decision", "Every new decision, with the receipt."],
                  ["consent.withdrawn", "withdrawal", "A visitor revokes consent or turns off a category their previous decision allowed. Lists the categories in withdrawn."],
                  ["leak.detected", "leak", "A tracker fired after the visitor declined its category."],
                ]}
              />
              <CodeBlock title="Payloads" language="js" code={WEBHOOK_PAYLOADS} />
              <p>
                Each delivery is a <code>POST</code> with <code>content-type: application/json</code> and these headers:{" "}
                <code>X-Plain-Signature</code> (<code>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>), <code>X-Plain-Event</code> (the
                event name) and <code>X-Plain-Delivery</code> (an id that stays the same across retries, so you can skip duplicates).
                A test delivery adds <code>&quot;test&quot;: true</code> and a sample receipt.
              </p>
              <SubHeading>Verify the signature</SubHeading>
              <p>
                <code>v1</code> is the hex HMAC-SHA256 of <code>{"`${t}.${rawBody}`"}</code>, keyed with your signing secret. Compute it
                over the raw body, compare in constant time and reject timestamps more than five minutes old.
              </p>
              <CodeBlock title="verify-plain-signature.js (Node.js)" language="js" code={VERIFY_SNIPPET} />
              <SubHeading>Retries and the delivery log</SubHeading>
              <p>
                Any <code>2xx</code> response within 5 seconds counts as delivered. Otherwise the delivery is tried up to 3 times in
                all, 1 second and then 4 seconds after the previous attempt. A <code>4xx</code> other than <code>408</code> or{" "}
                <code>429</code> is not retried, and redirects are not followed. Every attempt, with its status code and duration,
                appears in the delivery log on the Webhooks page, which keeps 30 days.
              </p>
            </DocSection>

            <DocSection id="rest-api" title="REST API">
              <p>
                The script calls these endpoints for you, at <code>{API}</code>. Every endpoint answers <code>OPTIONS</code>{" "}
                preflights and allows cross-origin requests from any origin (<code>Access-Control-Allow-Origin: *</code>, methods{" "}
                <code>GET, POST, OPTIONS</code>, header <code>content-type</code>). <code>POST</code> bodies are JSON of at most 8,000
                characters, sent as <code>application/json</code> or <code>text/plain</code> (as <code>sendBeacon</code> does).
              </p>
              <Params
                caption="Public endpoints"
                head={["Endpoint", "Success"]}
                rows={[
                  ["GET /config/:siteKey", "200 JSON", "The published config: the snapshot taken at publish time, never a draft. Location in x-plain-country and x-plain-region. Cached for 60 seconds."],
                  ["POST /consent", "201 JSON", "Record a decision. Returns { id, hash, seq } for the new receipt."],
                  ["POST /event", "204", "Banner impression or bounce: { siteKey, kind: \"view\" | \"bounce\" }."],
                  ["POST /leak", "201 JSON", "Report a leak: { siteKey, url, category, page, framework }. Returns { id }."],
                  ["GET /receipts/:visitorId?siteKey=", "200 JSON", "A visitor's own history: { site, receipts: [{ action, framework, categories, timestamp, hash }] }. Never cached."],
                  ["GET /anchors/:siteKey", "200 JSON", "Daily chain anchors for the last 30 days plus the current head, for checking later that the log was never rewritten."],
                ]}
              />
              <CodeBlock title="POST /consent" language="json" code={CONSENT_BODY} />
              <Params
                caption="Consent body fields"
                head={["Field", "Type"]}
                rows={[
                  ["siteKey", "string", "The site key from data-site."],
                  ["visitorId", "string", "16 to 64 lowercase hex characters, random per browser. Never derived from personal data."],
                  ["action", "string", "accept_all, reject_all, custom or revoke."],
                  ["framework", "string", "gdpr, ccpa, dpdpa or generic: the notice that was shown."],
                  ["categories", "object", "essential, functional, analytics and marketing, each a boolean. essential is always stored as true."],
                  ["configVersion", "integer", "The published config version the choice was made against."],
                  ["gpc", "boolean?", "The browser sent Global Privacy Control and the decision honoured it."],
                  ["automated", "boolean?", "An automated browser made the choice (navigator.webdriver)."],
                  ["language", "string?", "The language the notice was shown in, e.g. en or fr-CA."],
                ]}
              />
              <p>
                The server adds the time, country, device, browser and a salted hash of the IP address that changes daily before
                writing the receipt. Leak reports take an <code>http(s)</code> <code>url</code> and a <code>page</code> path, both
                without a query string; <code>category</code> is <code>functional</code>, <code>analytics</code> or{" "}
                <code>marketing</code>. The anchors response is{" "}
                <code>{`{ site, algorithm: "sha256-chain", generatedAt, head: { seq, hash, timestamp } | null, anchors: [{ day, seq, hash, receipts }] }`}</code>
                .
              </p>
              <SubHeading>Origins and rate limits</SubHeading>
              <p>
                <code>/consent</code>, <code>/event</code> and <code>/leak</code> only accept requests whose <code>Origin</code> (or{" "}
                <code>Referer</code>) is your site&apos;s domain or a subdomain of it, so they work from the browser, not from a server.
                Limits are per anonymised network address, per minute:
              </p>
              <Params
                caption="Rate limits"
                head={["Endpoint", "Per minute"]}
                rows={[
                  ["/consent", "30", "Decisions."],
                  ["/event", "120", "Impressions and bounces."],
                  ["/leak", "20", "Leak reports."],
                  ["/receipts", "20", "History lookups."],
                ]}
              />
              <SubHeading>Errors</SubHeading>
              <p>Every error has the same shape. Rate-limited responses carry <code>Retry-After: 60</code>.</p>
              <CodeBlock title="Error response" language="json" code={ERROR_BODY} />
              <Params
                caption="Error codes"
                head={["Code", "Status"]}
                rows={[
                  ["bad_request", "400", "The body isn't JSON or is too large, or a path or query value is malformed."],
                  ["invalid_body", "400", "Fields are missing or invalid; fields lists each one."],
                  ["forbidden_origin", "403", "The request didn't come from the site's domain or a subdomain of it."],
                  ["not_found", "404", "Unknown site key."],
                  ["not_published", "404", "The site has no published banner yet (config only)."],
                  ["rate_limited", "429", "Too many requests from this network. Try again in a minute."],
                ]}
              />
            </DocSection>

            <DocSection id="team" title="Team and sign-in">
              <p>
                Sign in at{" "}
                <Link href="/auth/login" className={LINK}>
                  /auth/login
                </Link>{" "}
                and create an account at{" "}
                <Link href="/auth/signup" className={LINK}>
                  /auth/signup
                </Link>
                . Forgot your password? On{" "}
                <Link href="/auth/forgot-password" className={LINK}>
                  /auth/forgot-password
                </Link>{" "}
                we email a 6-digit code that works once, for 15 minutes; enter it with a new password on the reset page.
              </p>
              <p>
                Owners and admins invite people from the Team page as Admin, Editor, Auditor or Viewer. The invite link opens the
                sign-up page with the invited address filled in; the invitee chooses a password, confirms the address with the
                emailed code if asked, and joins the organization with the invited role. Someone who already has an account is added
                straight away and only needs to sign in.
              </p>
              <Params
                caption="Roles"
                head={["Role", "Access"]}
                rows={[
                  ["Owner", "everything", "Everything, including billing, security policy and deleting the organization."],
                  ["Admin", "manage", "Add and delete sites, edit banners and manage the team. Can't manage owners or billing."],
                  ["Editor", "edit", "Edit banners, regions, languages and trackers, and publish. Can't add or delete sites."],
                  ["Auditor", "read + export", "Read-only, plus export consent logs and Evidence Packs and read the audit log."],
                  ["Viewer", "read", "See analytics and export consent logs and Evidence Packs. Can't change anything."],
                ]}
              />
            </DocSection>
          </article>
        </div>
      </div>
    </>
  );
}
