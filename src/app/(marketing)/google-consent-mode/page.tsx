import Link from "next/link";
import { CodeFragment, FeatureClose, FeatureFaq, FeatureHeading, HeroActions, Rings, Stage } from "@/components/marketing/feature-page";
import type { FaqItem } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { ArrowLink, Section } from "@/components/marketing/primitives";
import { pageMetadata } from "@/lib/seo";

const PATH = "/google-consent-mode";

export const metadata = pageMetadata({
  title: "Google Consent Mode v2 CMP Setup",
  description: "Send Google Consent Mode v2 signals from your cookie banner: defaults before Google tags run, an update the moment a visitor chooses, and no custom code.",
  path: PATH,
  socialTitle: "Google Consent Mode v2, set from your banner",
  kicker: "Google Consent Mode",
});

const FAQ: FaqItem[] = [
  {
    q: "What is Google Consent Mode v2?",
    a: "It's how a website tells Google tags what a visitor agreed to. The page sends consent signals such as ad_storage and analytics_storage, and Google tags adjust what they store and send. Version 2 added ad_user_data and ad_personalization.",
  },
  {
    q: "Which signals does Plain Theory send?",
    a: "All seven: ad_storage, ad_user_data and ad_personalization follow marketing; analytics_storage follows analytics; functionality_storage and personalization_storage follow preferences; security_storage is always granted.",
  },
  {
    q: "Do I need Google Tag Manager?",
    a: "No. With Consent Mode on, the script defines a gtag function if your page doesn't have one yet, so the signals queue even before gtag.js loads. Google Tag Manager is never held, so its own consent checks read the same signals.",
  },
  {
    q: "Does Consent Mode replace blocking?",
    a: "No, they work together. Consent Mode tells Google tags what the visitor allowed. Blocking keeps every other tracker you mark, and the ones we recognise, off until the visitor agrees to its category.",
    link: { href: "/cookie-consent#blocking", label: "How blocking works" },
  },
  {
    q: "Does it work with my own banner?",
    a: "Yes. In headless mode the script draws nothing, and the defaults and updates still go out whenever your interface calls the JavaScript API.",
    link: { href: "/docs#headless", label: "Headless mode in the docs" },
  },
];

const MAP: { cat: string; signals: string[]; rule: string }[] = [
  { cat: "Marketing", signals: ["ad_storage", "ad_user_data", "ad_personalization"], rule: "Granted when marketing is allowed." },
  { cat: "Analytics", signals: ["analytics_storage"], rule: "Granted when analytics is allowed." },
  { cat: "Preferences", signals: ["functionality_storage", "personalization_storage"], rule: "Granted when preferences are allowed." },
  { cat: "Always", signals: ["security_storage"], rule: "Always granted." },
];

/** The seven signals after a visitor allowed analytics and declined marketing. */
function SignalsFragment() {
  const rows: [string, boolean][] = [
    ["ad_storage", false],
    ["ad_user_data", false],
    ["ad_personalization", false],
    ["analytics_storage", true],
    ["functionality_storage", true],
    ["personalization_storage", true],
    ["security_storage", true],
  ];
  return (
    <Stage tone="dark" label="After a visitor allowed analytics and preferences, and declined marketing.">
      <div className="rounded-[14px] bg-soot-3 px-5 py-4">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-[0.875rem]">
          <span className="font-medium text-white">gtag(&quot;consent&quot;, &quot;update&quot;)</span>
          <span className="text-mute">10:42:07</span>
        </p>
        <dl className="mt-3 space-y-1.5 text-[0.9375rem]">
          {rows.map(([k, on]) => (
            <div key={k} className="flex flex-wrap justify-between gap-x-6">
              <dt className="text-mute [overflow-wrap:anywhere]">{k}</dt>
              <dd className={`font-medium ${on ? "text-lime" : "text-white"}`}>{on ? "granted" : "denied"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Stage>
  );
}

/** The Banner studio switch and the install tag it adds an attribute to. */
function SetupFragment() {
  return (
    <Stage tone="dark" label="One switch in Banner studio. The install tag picks it up.">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] bg-white px-5 py-4 text-soot">
        <span>
          <span className="block font-semibold">Google Consent Mode v2</span>
          <span className="block text-[0.875rem] text-mute-ink">Send consent signals to Google tags</span>
        </span>
        <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-soot">
          <span className="absolute right-1 top-1 size-5 rounded-full bg-lime" />
        </span>
        <span className="sr-only">On</span>
      </div>
      <div className="mt-2">
        <CodeFragment title="First inside <head>" code={`<script src="https://…/plain-consent.js"\n  data-site="pk_live_YOUR_SITE_KEY"\n  data-gcm="true"></script>`} />
      </div>
    </Stage>
  );
}

export default function GoogleConsentModePage() {
  return (
    <>
      <PageHero
        tone="ink"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Google Consent Mode v2", href: PATH },
        ]}
        title="Google Consent Mode v2, set from your banner"
        lead="Turn on Consent Mode once and the banner speaks to Google tags for you: a default before they run, and an update the moment a visitor chooses or changes their mind."
        figure={<SignalsFragment />}
      >
        <HeroActions docs="/docs#consent-mode" />
      </PageHero>

      <Section id="signals" tone="white" labelledBy="signals-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <FeatureHeading id="signals-h" text="Defaults first, then every choice" />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              Google tags need to know the visitor&apos;s consent before they store anything. The banner handles the order for you.
            </p>
            <ol className="mt-8 divide-y divide-line border-y border-line">
              {[
                ["Before Google tags run", "A default signal goes out at once, with wait_for_update set to 500 milliseconds so tags hold briefly for the visitor's choice."],
                ["When the visitor chooses", "An update follows immediately: accept, reject or a choice category by category."],
                ["Whenever it changes", "Changing preferences later, or withdrawing consent, sends a fresh update. The signals always match the choice on record."],
              ].map(([t, d], i) => (
                <li key={t} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-5">
                  <span aria-hidden className="font-mono text-[0.875rem] text-mute-ink">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block font-semibold">{t}</span>
                    <span className="mt-1 block text-[1rem] leading-[1.55] text-ink-2">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-6">
            <Stage label="The default under an opt-in notice, before anyone has chosen.">
              <CodeFragment
                title="Sent by the script"
                code={`gtag("consent", "default", {\n  ad_storage: "denied",\n  ad_user_data: "denied",\n  ad_personalization: "denied",\n  analytics_storage: "denied",\n  functionality_storage: "denied",\n  personalization_storage: "denied",\n  security_storage: "granted",\n  wait_for_update: 500\n});`}
              />
            </Stage>
          </div>
        </div>
      </Section>

      <Section id="mapping" tone="paper" labelledBy="mapping-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FeatureHeading id="mapping-h" text="Your categories, Google's signals" />
            <p className="mt-4 max-w-[40ch] text-[1rem] leading-[1.6]">
              Visitors choose in plain words. Each category maps to the Consent Mode signals it covers, so nobody has to learn Google&apos;s
              vocabulary.
            </p>
          </div>
          <dl className="divide-y divide-line border-y border-line lg:col-span-8">
            {MAP.map((m, i) => (
              <div key={m.cat} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-2 py-6 md:grid-cols-[minmax(0,160px)_1fr] md:gap-8">
                <dt className="font-semibold">{m.cat}</dt>
                <dd>
                  <span className="flex flex-wrap gap-1.5">
                    {m.signals.map((s) => (
                      <code key={s} className="rounded-full bg-white px-3 py-1 font-mono text-[0.875rem] [overflow-wrap:anywhere]">
                        {s}
                      </code>
                    ))}
                  </span>
                  <span className="mt-2 block text-[1rem] text-ink-2">{m.rule}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section id="setup" tone="ink" labelledBy="setup-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <FeatureHeading id="setup-h" text="Switched on in Banner studio" />
            <Rings
              className="mt-6 max-w-[60ch]"
              items={[
                "Turn on Google Consent Mode v2 in Banner studio and publish. There's no code to write.",
                "Your install tag then carries data-gcm, so the defaults reach Google tags before the banner's settings have even loaded.",
                "Load Google tags as you normally would. They read the signals; Google Tag Manager is never held.",
                "On a first visit, gtag.js, Google Analytics and Google Ads are held until the defaults are out, so nothing runs ahead of them.",
              ]}
            />
            <p className="mt-6 max-w-[60ch] text-[1rem] leading-[1.6] text-white/80">
              The{" "}
              <Link href="/consent-log#evidence" className="font-medium text-white underline underline-offset-4">
                Evidence Pack
              </Link>{" "}
              records whether Consent Mode was on, alongside the banner your visitors saw.
            </p>
          </div>
          <div className="lg:col-span-6">
            <SetupFragment />
          </div>
        </div>
      </Section>

      <Section id="regions" tone="white" labelledBy="regions-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <FeatureHeading id="regions-h" text="Signals that follow the law the visitor is under" />
            <p className="mt-4 max-w-[44ch] text-[1rem] leading-[1.6]">
              The visitor&apos;s location picks their notice, and the notice decides where the signals start.
            </p>
            <div className="mt-6 flex flex-col items-start gap-3">
              <ArrowLink href="/compliance/gdpr">GDPR guide</ArrowLink>
              <ArrowLink href="/compliance/ccpa">CCPA and Global Privacy Control</ArrowLink>
            </div>
          </div>
          <dl className="divide-y divide-line border-y border-line lg:col-span-7">
            {[
              ["Opt-in notices", "The default under GDPR and the DPDP Act. Every signal except security_storage starts denied and stays that way until the visitor agrees."],
              ["Opt-out notices", "The default under CCPA. Signals start granted, and Reject turns them off."],
              ["Global Privacy Control", "When a browser sends GPC under an opt-out notice, marketing starts off, so the three ad signals start denied."],
            ].map(([k, v], i) => (
              <div key={k} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-1.5 py-5 md:grid-cols-[minmax(0,200px)_1fr] md:gap-8">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-[1rem] leading-[1.55] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <FeatureFaq items={FAQ} />
      <FeatureClose current={PATH} />
    </>
  );
}
