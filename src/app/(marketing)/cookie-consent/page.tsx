import Link from "next/link";
import { CodeFragment, FeatureClose, FeatureFaq, FeatureHeading, HeroActions, Rings, Stage } from "@/components/marketing/feature-page";
import type { FaqItem } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { ArrowLink, Section } from "@/components/marketing/primitives";
import { pageMetadata } from "@/lib/seo";

const PATH = "/cookie-consent";

export const metadata = pageMetadata({
  title: "Cookie Banner & Consent Tool for Websites",
  description: "A cookie consent banner that blocks trackers until visitors agree, shows the right notice for GDPR, CCPA and the DPDP Act, and logs every choice as proof.",
  path: PATH,
  socialTitle: "A cookie banner that actually blocks trackers",
  kicker: "Consent banner",
});

const FAQ: FaqItem[] = [
  {
    q: "Does the banner block trackers, or only show a notice?",
    a: "It blocks them. The scripts you mark, and the trackers our cookie scanner recognises, stay off until the visitor agrees to their category. If one still fires after a visitor declines, it appears on your Leaks page with the page it fired on.",
    link: { href: "/docs#blocking", label: "How blocking works" },
  },
  {
    q: "Is rejecting as easy as accepting?",
    a: "Yes. Accept and Reject carry equal weight by default, on the first layer of the banner. A Choose button opens the preferences panel for visitors who want to decide category by category.",
  },
  {
    q: "Which laws does the banner cover?",
    a: "GDPR and UK GDPR, CCPA/CPRA with Global Privacy Control, and the DPDP Act, 2023 with the 2025 Rules. The visitor's location decides which notice they see, in their language where you've added it.",
  },
  {
    q: "Will the banner slow my site down or clash with my design?",
    a: "No. The script is small, loads once per visit and is served from a location close to each visitor. The banner renders in a closed shadow root, so your CSS can't break it and it can't restyle your page or move your layout.",
  },
  {
    q: "Can I use my own banner design instead?",
    a: "Yes. Turn on headless mode in Banner studio and the script renders nothing. Blocking, storage, Google Consent Mode and consent records all keep working while your own interface calls the JavaScript API.",
    link: { href: "/docs#headless", label: "Headless mode in the docs" },
  },
];

const REGIONS: { where: string; notice: string; model: string }[] = [
  { where: "EU, EEA, UK and Switzerland", notice: "GDPR", model: "Opt-in. Nothing non-essential runs until the visitor accepts." },
  { where: "California", notice: "CCPA and CPRA", model: "Opt-out. Trackers start on and Reject switches them off. Global Privacy Control turns marketing off." },
  { where: "Where the DPDP Act applies", notice: "DPDP Act", model: "Opt-in, with your Data Protection Officer's contact details in the preferences panel." },
  { where: "Everywhere else", notice: "Your default", model: "The notice you set as the default. Any region you turn off falls back to it." },
];

/** The banner's first layer and what it is holding, as a visitor's browser has it before they choose. */
function BannerFragment() {
  const held: [string, string][] = [
    ["googletagmanager.com/gtag", "Analytics"],
    ["connect.facebook.net", "Marketing"],
    ["static.hotjar.com", "Analytics"],
  ];
  return (
    <Stage tone="dark" label="Before the visitor chooses: the banner is up and known trackers are held.">
      <div className="rounded-[14px] bg-white p-5 text-soot">
        <p className="text-[1.0625rem] font-semibold tracking-[-0.015em]">We use cookies for analytics and ads.</p>
        <p className="mt-1.5 text-[0.9375rem] leading-[1.5] text-mute-ink">Choose what runs on this site. You can change it any time.</p>
        <p className="mt-4 flex flex-wrap gap-2 text-[0.9375rem] font-medium">
          {/* Reject and Accept always carry equal weight */}
          <span className="rounded-full bg-lime px-4 py-1.5">Reject</span>
          <span className="rounded-full bg-lime px-4 py-1.5">Accept</span>
          <span className="rounded-full bg-chalk px-4 py-1.5">Choose</span>
        </p>
      </div>
      <ul className="mt-2 space-y-1.5">
        {held.map(([host, cat]) => (
          <li key={host} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[12px] bg-soot-3 px-4 py-2.5 text-[0.875rem]">
            <span className="font-medium text-white [overflow-wrap:anywhere]">{host}</span>
            <span className="inline-flex items-center gap-1.5 text-mute">
              <span aria-hidden className="size-2 rounded-full bg-amber-bright" />
              {cat}, held
            </span>
          </li>
        ))}
      </ul>
    </Stage>
  );
}

/** The three banner layouts, drawn as small page silhouettes. */
function LayoutFragment() {
  const page = "relative aspect-[4/3] overflow-hidden rounded-[12px] bg-soot-3";
  const lines = (
    <span aria-hidden className="absolute inset-x-3 top-3 space-y-1.5">
      <span className="block h-1.5 w-2/3 rounded-full bg-white/15" />
      <span className="block h-1.5 w-1/2 rounded-full bg-white/10" />
    </span>
  );
  return (
    <Stage tone="dark" label="Bar, modal or corner toast. Accept and Reject are equal in each.">
      <ul className="grid grid-cols-3 gap-2">
        <li>
          <div className={page}>
            {lines}
            <span aria-hidden className="absolute inset-x-0 bottom-0 flex h-[28%] items-center justify-end gap-1 bg-white px-2">
              <span className="h-2 w-5 rounded-full bg-lime" />
              <span className="h-2 w-5 rounded-full bg-lime" />
            </span>
          </div>
          <p className="mt-2 text-[0.875rem] text-white">Bar</p>
        </li>
        <li>
          <div className={page}>
            {lines}
            <span aria-hidden className="absolute inset-0 bg-black/40" />
            <span aria-hidden className="absolute inset-x-[18%] top-[24%] flex h-[52%] items-end justify-center gap-1 rounded-[8px] bg-white pb-2">
              <span className="h-2 w-5 rounded-full bg-lime" />
              <span className="h-2 w-5 rounded-full bg-lime" />
            </span>
          </div>
          <p className="mt-2 text-[0.875rem] text-white">Modal</p>
        </li>
        <li>
          <div className={page}>
            {lines}
            <span aria-hidden className="absolute bottom-2 right-2 flex h-[36%] w-[52%] items-end justify-center gap-1 rounded-[8px] bg-white pb-1.5">
              <span className="h-2 w-4 rounded-full bg-lime" />
              <span className="h-2 w-4 rounded-full bg-lime" />
            </span>
          </div>
          <p className="mt-2 text-[0.875rem] text-white">Corner toast</p>
        </li>
      </ul>
    </Stage>
  );
}

export default function CookieConsentPage() {
  return (
    <>
      <PageHero
        tone="ink"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Consent banner", href: PATH },
        ]}
        title="A cookie banner that actually blocks trackers"
        lead="Plain Theory's consent banner holds analytics and advertising scripts until a visitor agrees to their category, shows the notice their location calls for, and records the choice in a log auditors can verify."
        figure={<BannerFragment />}
      >
        <HeroActions docs="/docs#install" />
      </PageHero>

      <Section id="blocking" tone="white" labelledBy="blocking-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <FeatureHeading id="blocking-h" text="Held until the visitor says yes" />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              A banner that only asks leaves the trackers running. This one keeps them off until the visitor agrees to their category, then lets
              them run exactly once.
            </p>
            <Rings
              className="mt-6 max-w-[60ch]"
              items={[
                <>
                  <strong className="font-semibold">Known trackers, from the first instant.</strong> Google Analytics, Hotjar, Microsoft Clarity,
                  Meta Pixel, LinkedIn Insight, TikTok Pixel and Google Ads are recognised before your settings even load.
                </>,
                <>
                  <strong className="font-semibold">Your own scripts.</strong> Change a script&apos;s type to text/plain and name its category. It
                  stays inert until that category is allowed.
                </>,
                <>
                  <strong className="font-semibold">Scripts added later.</strong> Scripts and iframes injected after the page loads are held when
                  they match a known tracker or one on your Trackers page.
                </>,
                <>
                  <strong className="font-semibold">Leaks, caught.</strong> If a tracker still fires after a decline, your Leaks page shows it with
                  the page it fired on. Essential scripts are never blocked.
                </>,
              ]}
            />
          </div>
          <div className="lg:col-span-6">
            <Stage label="Static blocking: each script waits for its own category.">
              <CodeFragment
                title="Your page"
                code={`<script type="text/plain" data-consent="analytics"\n  src="https://www.googletagmanager.com/gtag/js?id=G-XXXX">\n</script>\n\n<script type="text/plain" data-consent="marketing">\n  fbq('init', '000000000000');\n</script>`}
              />
              <dl className="mt-2 grid grid-cols-2 gap-2 text-[0.875rem] sm:grid-cols-4">
                {[
                  ["Essential", "Always on"],
                  ["Functional", "Asks first"],
                  ["Analytics", "Asks first"],
                  ["Marketing", "Asks first"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[12px] bg-white px-3 py-2.5">
                    <dt className="font-medium">{k}</dt>
                    <dd className="text-mute-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Stage>
          </div>
        </div>
      </Section>

      <Section id="regions" tone="paper" labelledBy="regions-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FeatureHeading id="regions-h" text="The right notice for each visitor" />
            <p className="mt-4 max-w-[40ch] text-[1rem] leading-[1.6]">
              One install, one banner. The visitor&apos;s location picks the notice, and the notice decides whether trackers start off or on.
            </p>
            <p className="mt-4 max-w-[40ch] text-[1rem] leading-[1.6]">
              Notices can be shown in English, German, French, Spanish, Italian, Dutch and Portuguese, and in all 22 languages the DPDP Act
              covers, from Assamese to Urdu.
            </p>
            <div className="mt-6">
              <ArrowLink href="/docs#regions">How regions are chosen</ArrowLink>
            </div>
          </div>
          <dl className="divide-y divide-line border-y border-line lg:col-span-8">
            {REGIONS.map((r, i) => (
              <div key={r.where} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-1.5 py-6 md:grid-cols-[minmax(0,220px)_minmax(0,140px)_1fr] md:gap-8">
                <dt className="font-semibold">{r.where}</dt>
                <dd className="text-[0.9375rem] font-medium">{r.notice}</dd>
                <dd className="text-[1rem] leading-[1.55] text-ink-2">{r.model}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section id="studio" tone="ink" labelledBy="studio-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <FeatureHeading id="studio-h" text="Designed in Banner studio, never in your way" />
            <Rings
              className="mt-6 max-w-[60ch]"
              items={[
                "Choose the layout, position, colours, corner radius, font and copy, and preview it before you publish.",
                "Accept and Reject carry equal weight by default, with a Choose button for category-by-category decisions.",
                "The banner renders in a closed shadow root: your CSS can't break it, and it can't restyle your page or move your layout.",
                "Keyboard and screen-reader ready: a labelled region for the bar and toast, and a modal dialog with a focus trap.",
                "Publishing creates a new version. Visitors who chose under an older one are asked again.",
              ]}
            />
            <p className="mt-6 max-w-[60ch] text-[1rem] leading-[1.6] text-white/80">
              Want your own interface? Headless mode turns the banner off and keeps blocking, storage and records running behind your design.
            </p>
          </div>
          <div className="lg:col-span-6">
            <LayoutFragment />
          </div>
        </div>
      </Section>

      <Section id="install" tone="white" labelledBy="install-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="order-2 lg:order-1 lg:col-span-6">
            <Stage label="The same tag works in every framework.">
              <CodeFragment title="Every page, first inside <head>" code={`<script src="https://…/plain-consent.js"\n  data-site="pk_live_YOUR_SITE_KEY"></script>`} />
              <p className="mt-3 flex flex-wrap gap-1.5 text-[0.875rem] font-medium">
                {["HTML", "Next.js", "React", "Vue", "Svelte", "Angular", "WordPress"].map((f) => (
                  <span key={f} className="rounded-full bg-white px-3 py-1">
                    {f}
                  </span>
                ))}
              </p>
            </Stage>
          </div>
          <div className="order-1 lg:order-2 lg:col-span-6">
            <FeatureHeading id="install-h" text="One script tag, first in the head" />
            <p className="mt-4 max-w-[56ch] text-[1.125rem] leading-[1.55]">
              Paste it above Google Tag Manager, analytics and ad scripts. Scripts parsed before it can&apos;t be held, so order matters, and
              that&apos;s the only rule.
            </p>
            <p className="mt-4 max-w-[56ch] text-[1rem] leading-[1.6] text-mute-ink">
              Then run a{" "}
              <Link href="/cookie-scanner" className="mk-link font-medium text-soot">
                cookie scan
              </Link>{" "}
              to find what your site sets, turn on{" "}
              <Link href="/google-consent-mode" className="mk-link font-medium text-soot">
                Google Consent Mode v2
              </Link>{" "}
              if you use Google tags, and every choice lands in the{" "}
              <Link href="/consent-log" className="mk-link font-medium text-soot">
                consent log
              </Link>
              .
            </p>
            <div className="mt-6">
              <ArrowLink href="/docs#install">Install guide</ArrowLink>
            </div>
          </div>
        </div>
      </Section>

      <FeatureFaq items={FAQ} />
      <FeatureClose current={PATH} />
    </>
  );
}
