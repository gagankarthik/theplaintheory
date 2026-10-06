import { pageMetadata } from "@/lib/seo";
import type { ReactNode } from "react";
import { CodeBlock, CodeTabs } from "@/components/marketing/docs/code-block";
import { INSTALL_SNIPPETS, PACKAGE_SNIPPETS } from "@/components/marketing/docs/framework-snippets";
import { PageHero } from "@/components/marketing/page-hero";
import { Toc, type TocItem } from "@/components/marketing/toc";
import { sdkSizeLabel } from "@/lib/sdk-size";

export const metadata = pageMetadata({
  title: "Developer documentation",
  description: "Install the Plain Theory consent script in HTML, Next.js, React, Vite, Vue, Svelte, Angular or WordPress, then set up banners, regions and the API.",
  path: "/docs",
  socialTitle: "Install in one line, then configure",
});

const TOC: TocItem[] = [
  { id: "install", label: "Install" },
  { id: "frameworks", label: "Framework packages" },
  { id: "wordpress", label: "WordPress" },
  { id: "blocking", label: "Block trackers" },
  { id: "banner", label: "Banner and copy" },
  { id: "regions", label: "Regions" },
  { id: "api", label: "JavaScript API" },
  { id: "headless", label: "Headless mode" },
  { id: "consent-mode", label: "Google Consent Mode" },
  { id: "scanner", label: "Tracker scanner" },
  { id: "analytics", label: "Consent analytics" },
  { id: "rest-api", label: "REST API" },
];

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

function Params({ caption, rows }: { caption: string; rows: [name: string, type: string, description: string][] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-paper text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Type
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
  );
}

/** Package, what it targets, and what it exports. Stacks on small screens instead of scrolling sideways. */
function PackageList({ items }: { items: [name: string, target: string, exports: string][] }) {
  return (
    <dl className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
      {items.map(([name, target, exports]) => (
        <div key={name} className="grid gap-1.5 px-4 py-3.5 sm:grid-cols-[minmax(0,210px)_minmax(0,1fr)] sm:gap-x-6">
          <dt>
            <span className="block font-mono text-[13px] text-ink">{name}</span>
            <span className="mt-0.5 block text-xs text-ink-3">{target}</span>
          </dt>
          <dd className="text-sm text-ink-2">{exports}</dd>
        </div>
      ))}
    </dl>
  );
}

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
        meta={`SDK version 1.0.0. ${sdkSizeLabel()} gzipped.`}
      />

      <div className="bg-surface">
        <div className="container-page grid gap-12 py-16 md:py-20 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-28">
              <Toc items={TOC} label="Contents" />
            </div>
          </aside>

          <article className="min-w-0 space-y-16 lg:col-span-9 lg:max-w-[780px] lg:pl-8">
            <DocSection id="install" title="Install">
              <p>
                Add the script as the <strong className="font-semibold text-ink">first script in your page&apos;s head</strong>, with
                your site key from the dashboard&apos;s Install page. Scripts parsed before it can&apos;t be held, so order matters.
              </p>
              <CodeTabs tabs={INSTALL_SNIPPETS} />
              <p>
                Using a framework? The tag above is still the best first step, because it&apos;s the only way to hold trackers written
                into your HTML. Then add the <a href="#frameworks" className="font-medium text-ink underline underline-offset-4">framework package</a>{" "}
                for typed state, hooks and consent-gated components. The packages see the tag and don&apos;t load a second copy.
              </p>
              <p>The script reads these attributes from its own tag:</p>
              <Params
                caption="Script tag attributes"
                rows={[
                  ["data-site", "string", "Your public site key. Required."],
                  ["data-api", "URL", "API base for receipts and events. Defaults to the script's origin + /api/v1."],
                  ["data-config-url", "URL", "Where to fetch the published config. Defaults to {api}/config/{site key}."],
                  ["data-debug", "flag", "Allows ?plain_country= and ?plain_region= to override location for testing. Always on for localhost."],
                ]}
              />
            </DocSection>

            <DocSection id="frameworks" title="Framework packages">
              <p>
                Each package wraps the same script, so behaviour is identical everywhere. They&apos;re ESM, tree-shakeable, typed, and safe
                to import during server rendering: state is <code>null</code> on the server and until the script is ready.
              </p>
              <PackageList
                items={[
                  ["@plaintheory/consent", "Any framework", "loadPlainConsent, getConsent, onConsentChange, whenAllowed, loadScriptWhenAllowed and the types."],
                  ["@plaintheory/react", "React 18+, Next.js, Vite", "PlainConsentProvider, useConsent, useConsentAllowed, ConsentGate, ConsentScript, PrivacyChoicesButton."],
                  ["@plaintheory/vue", "Vue 3.3+, Nuxt 3", "createPlainConsent plugin, useConsent composable, ConsentGate component."],
                  ["@plaintheory/svelte", "Svelte 4 and 5, SvelteKit", "consent store, allowed(category) store, init and actions."],
                  ["PlainConsentService", "Angular 16+", "Signals service with state, ready, allowed(category), init and actions. Copy it from packages/angular."],
                ]}
              />
              <CodeBlock title="Install" language="bash" code={`npm i @plaintheory/react    # or @plaintheory/vue, @plaintheory/svelte, @plaintheory/consent`} />
              <CodeTabs tabs={PACKAGE_SNIPPETS} />
              <p>
                Categories are <code>essential</code> (always allowed), <code>functional</code>, <code>analytics</code> and{" "}
                <code>marketing</code>. Actions such as <code>open()</code> and <code>acceptAll()</code> queue safely if the script hasn&apos;t
                loaded yet. <code>ConsentScript</code> and <code>loadScriptWhenAllowed</code> add a script once; a later withdrawal takes
                effect from the next page view, since a running script can&apos;t be unloaded.
              </p>
            </DocSection>

            <DocSection id="wordpress" title="WordPress">
              <p>
                The Plain Theory Consent plugin prints the script first in <code>&lt;head&gt;</code> and can hold scripts that other plugins
                add, by their WordPress handle. Banner design, regions and languages stay in the dashboard.
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Install the plugin from <code>integrations/wordpress/plain-theory-consent</code> (zip the folder and upload it in Plugins → Add
                  New → Upload Plugin), then activate it.
                </li>
                <li>Open Settings → Plain Theory and paste your site key from Install in the dashboard.</li>
                <li>
                  Leave <strong>Load before other scripts</strong> on. A tracker that runs before the consent script can&apos;t be held.
                </li>
                <li>
                  Under <strong>Hold these scripts</strong>, list handles of scripts other plugins enqueue, one per line, as{" "}
                  <code>handle = analytics</code>, <code>marketing</code> or <code>functional</code>.
                </li>
              </ol>
              <CodeBlock
                title="Settings → Plain Theory"
                language="text"
                code={`Site key                 pk_live_YOUR_SITE_KEY
Load before other scripts  on
Hold these scripts       google-analytics = analytics
                         facebook-pixel   = marketing`}
              />
              <p>
                Held scripts are rewritten to <code>type=&quot;text/plain&quot; data-consent=&quot;…&quot;</code> through the{" "}
                <code>script_loader_tag</code> filter and run once the visitor allows that category. Known trackers inserted later are held
                automatically. The plugin stores one option and removes it on uninstall; it never shows review requests or admin notices.
              </p>
            </DocSection>

            <DocSection id="blocking" title="Block trackers">
              <p>
                Change the <code>type</code> of any script that needs consent to <code>text/plain</code> and name its category in{" "}
                <code>data-consent</code>. It stays inert until the visitor agrees to that category, then runs exactly once.
              </p>
              <CodeBlock
                title="Static blocking"
                language="html"
                code={`<script type="text/plain" data-consent="analytics"\n        src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>\n\n<script type="text/plain" data-consent="marketing">\n  fbq('init', '000000000000');\n</script>`}
              />
              <p>
                Scripts and iframes added later are held automatically when their <code>src</code> matches a known tracker or one on
                your Trackers page. Google Analytics, Hotjar, Microsoft Clarity, Meta Pixel, LinkedIn Insight, TikTok Pixel and Google
                Ads are recognised before your config even loads. Categories are <code>functional</code>, <code>analytics</code> and{" "}
                <code>marketing</code>; <code>essential</code> is never blocked.
              </p>
            </DocSection>

            <DocSection id="banner" title="Banner and copy">
              <p>
                Design the banner in the dashboard&apos;s Banner page: layout (bar, modal or corner toast), position, colours, corner
                radius, font and copy. Accept and reject are equal weight by default. Publishing creates a new config version, and
                visitors whose choice was made against an older version are asked again.
              </p>
              <p>
                The banner renders in a closed shadow root, so your CSS can&apos;t break it and it can&apos;t restyle your page. It&apos;s a
                labelled region for bar and toast layouts and a modal dialog with a focus trap for the modal layout.
              </p>
            </DocSection>

            <DocSection id="regions" title="Regions">
              <p>
                The config response carries the visitor&apos;s country in <code>x-plain-country</code> (and state in{" "}
                <code>x-plain-region</code>) from the CloudFront edge. The script picks a notice from it:
              </p>
              <Params
                caption="Country to notice mapping"
                rows={[
                  ["EU, EEA, UK, CH", "gdpr", "Opt-in. Nothing non-essential runs until the visitor accepts."],
                  ["US + CA", "ccpa", "Opt-out. Trackers start on; reject switches them off. Global Privacy Control turns off marketing."],
                  ["IN", "dpdpa", "Opt-in, with your DPO's contact details in the preferences panel."],
                  ["Everywhere else", "generic", "Your default notice. Falls back here if a region is turned off."],
                ]}
              />
              <p>
                Test locally with <code>?plain_country=IN</code> or <code>?plain_country=US&amp;plain_region=CA</code>.
              </p>
            </DocSection>

            <DocSection id="api" title="JavaScript API">
              <p>
                <code>window.PlainConsent</code> is available as soon as the script runs. To call it before then, push a function onto
                an array; the queue runs when the script loads.
              </p>
              <CodeBlock
                title="Reading and changing consent"
                language="js"
                code={`window.PlainConsent = window.PlainConsent || [];\nPlainConsent.push((pc) => {\n  pc.on("ready", (state) => console.log(state.framework, state.categories));\n});\n\n// later, from your own settings page\nPlainConsent.set({ analytics: true, marketing: false });\nPlainConsent.open();   // show the preferences panel\nPlainConsent.revoke(); // forget the choice and ask again`}
              />
              <Params
                caption="PlainConsent methods"
                rows={[
                  ["get()", "ConsentState", "{ framework, categories, decided, visitorId } for this visitor."],
                  ["acceptAll()", "void", "Grant every category and log an accept_all receipt."],
                  ["rejectAll()", "void", "Keep only essential and log a reject_all receipt."],
                  ["set(partial)", "void", "Merge category changes and log a custom receipt."],
                  ["open()", "void", "Show the preferences panel."],
                  ["revoke()", "void", "Clear the stored choice, log a revoke receipt and show the banner again."],
                  ["on(event, fn)", "() => void", "Listen for 'ready' or 'change'. Returns an unsubscribe function."],
                ]}
              />
              <p>
                Every change also fires a <code>plainconsent:change</code> event on <code>window</code> with the state in{" "}
                <code>event.detail</code>, for code that can&apos;t hold a reference to the API.
              </p>
            </DocSection>

            <DocSection id="headless" title="Headless mode">
              <p>
                Turn on headless mode in the Banner page and the script renders nothing. Blocking, storage, Google Consent Mode and
                receipts all keep working; you draw the interface and call the API.
              </p>
              <CodeBlock
                title="Your own banner"
                language="js"
                code={`PlainConsent.push((pc) => {\n  pc.on("ready", ({ decided }) => {\n    if (!decided) myBanner.show();\n  });\n  myBanner.onAccept = () => pc.acceptAll();\n  myBanner.onReject = () => pc.rejectAll();\n});`}
              />
            </DocSection>

            <DocSection id="consent-mode" title="Google Consent Mode v2">
              <p>
                With Consent Mode on, the script defines a <code>gtag</code> shim and sends a <code>default</code> signal immediately
                (with <code>wait_for_update: 500</code>), then an <code>update</code> whenever the choice changes. Load Google tags
                normally; they read the signals.
              </p>
              <Params
                caption="Consent Mode signals"
                rows={[
                  ["ad_storage, ad_user_data, ad_personalization", "marketing", "Granted when marketing is allowed."],
                  ["analytics_storage", "analytics", "Granted when analytics is allowed."],
                  ["functionality_storage, personalization_storage", "functional", "Granted when preferences are allowed."],
                  ["security_storage", "always", "Always granted."],
                ]}
              />
            </DocSection>

            <DocSection id="scanner" title="Tracker scanner">
              <p>
                The Trackers page can scan your site&apos;s homepage and list the third-party scripts it loads, matched against known
                trackers and sorted into categories. Review the list and add what you want held. The scanner only fetches public{" "}
                <code>http(s)</code> addresses and refuses private and internal networks.
              </p>
            </DocSection>

            <DocSection id="analytics" title="Consent analytics">
              <p>
                The Overview page shows opt-in, opt-out and partial consent rates and banner bounce rate, by day, country, notice,
                device and browser. Impressions come from a <code>view</code> event when the banner shows; a <code>bounce</code> is sent
                when someone leaves without choosing. Every chart has a table view.
              </p>
            </DocSection>

            <DocSection id="rest-api" title="REST API">
              <p>
                The script calls these endpoints for you. They allow cross-origin requests, and every error has the same shape:{" "}
                <code>{`{ "error": { "code", "message", "fields?" } }`}</code>.
              </p>
              <Params
                caption="Public endpoints"
                rows={[
                  ["GET /api/v1/config/:siteKey", "200 JSON", "The published config. Location in x-plain-country and x-plain-region."],
                  ["POST /api/v1/consent", "201 JSON", "Record a decision. Returns { id, hash, seq } for the new receipt."],
                  ["POST /api/v1/event", "204", "Banner impression or bounce: { siteKey, kind: 'view' | 'bounce' }."],
                  ["GET /api/v1/receipts/:visitorId", "200 JSON", "A visitor's own history, ?siteKey= required. Choices and hashes only."],
                ]}
              />
              <CodeBlock
                title="POST /api/v1/consent"
                language="json"
                code={`{\n  "siteKey": "pk_live_YOUR_SITE_KEY",\n  "visitorId": "3f9c0a1e7b2d4c6e8f00112233445566",\n  "action": "custom",\n  "framework": "dpdpa",\n  "categories": { "essential": true, "functional": true, "analytics": false, "marketing": false },\n  "configVersion": 4\n}`}
              />
              <p>
                Consent requests must come from your site&apos;s domain or a subdomain of it, and are rate limited per anonymised address.
                The server adds the time, country, device, browser and a truncated, salted hash of the IP address before writing the
                receipt.
              </p>
            </DocSection>
          </article>
        </div>
      </div>
    </>
  );
}
