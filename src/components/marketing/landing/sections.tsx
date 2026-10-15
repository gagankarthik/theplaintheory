import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconArrowRight,
  IconBalance,
  IconBrush,
  IconChain,
  IconFeather,
  IconHeld,
  IconLayoutBar,
  IconPlug,
  IconReceipt,
  IconScan,
  IconServer,
  type IconProps,
} from "@/components/icons";
import { INDUSTRY_LINKS } from "@/components/marketing/site-nav";
import { site } from "@/lib/site";

/** Icon in a lime tile, top-left of a card: 24px on a 40px square. */
function IconTile({ icon: Icon }: { icon: ComponentType<IconProps> }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lime text-soot">
      <Icon size={24} />
    </span>
  );
}

function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-4 text-[0.9375rem] font-medium text-soot hover:underline hover:underline-offset-4">
      {children}
      <IconArrowRight size={16} />
    </Link>
  );
}

function SectionHead({ id, title, lead, dark = false }: { id: string; title: string; lead: string; dark?: boolean }) {
  return (
    <div className="max-w-[720px]">
      <h2 id={id} className="text-[clamp(1.75rem,3vw,2.5rem)]">
        {title}
      </h2>
      <p className={`mt-3 text-[1.125rem] leading-[1.55] ${dark ? "text-white/85" : "text-mute-ink"}`}>{lead}</p>
    </div>
  );
}

/** Five facts that are true of the product today, straight under the hero. */
export function Facts({ sdkKb }: { sdkKb: string }) {
  const facts = [
    { icon: IconFeather, title: `${sdkKb} KB script`, body: "Kept under 10 KB in every release, so pages stay fast." },
    { icon: IconBalance, title: "GDPR, CCPA and DPDPA", body: "Each visitor sees the notice their law requires." },
    { icon: IconServer, title: "Stored in India", body: "Mumbai by default. EU or US residency on Enterprise." },
    { icon: IconChain, title: "Tamper-evident records", body: "Each consent record is chained to the one before it." },
    { icon: IconPlug, title: "Google Consent Mode v2", body: "Consent passed to your Google tags automatically." },
  ];
  return (
    <section aria-label="At a glance" className="on-light bg-white px-5 py-8 text-soot sm:px-8">
      <ul className="mx-auto grid max-w-[1440px] gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
        {facts.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <Icon size={24} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[1rem] font-semibold">{title}</p>
              <p className="mt-1 text-[0.9375rem] leading-[1.5] text-mute-ink">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CAPABILITIES = [
  {
    icon: IconLayoutBar,
    title: "Consent banner",
    body: "A bar, pop-up or corner notice in your brand and your visitor's language, with Accept and Reject given equal weight.",
    href: "/docs#banner",
    action: "Banner options",
  },
  {
    icon: IconHeld,
    title: "Script blocking",
    body: "Analytics and advertising tags stay off until the visitor agrees to their category. If one fires anyway, you are told where.",
    href: "/docs",
    action: "How blocking works",
  },
  {
    icon: IconScan,
    title: "Cookie scanner",
    body: "Scans your website as a first-time visitor, lists every cookie and tracker, and suggests a category for each one.",
    href: "/docs#scanner",
    action: "About the scanner",
  },
  {
    icon: IconReceipt,
    title: "Consent records",
    body: "Every choice is saved as a tamper-evident record. Check the whole log in one click and export it for an auditor.",
    href: "/security",
    action: "How records are kept",
  },
  {
    icon: IconBrush,
    title: "Banner studio",
    body: "Change layout, colours and wording with a live preview, then publish. Every published version is kept.",
    href: "/docs#banner",
    action: "Design your banner",
  },
  {
    icon: IconPlug,
    title: "Integrations",
    body: "One script tag for any website, with guides for WordPress, React, Next.js, Vue, Svelte and Angular, and Google Consent Mode v2.",
    href: "/docs#frameworks",
    action: "Install guides",
  },
];

/** The product in six cards: what each part does for the customer, and where to read more. */
export function Capabilities() {
  return (
    <section id="capabilities" aria-labelledby="capabilities-title" className="on-light scroll-mt-20 bg-chalk px-5 py-14 text-soot sm:px-8 md:py-16">
      <div className="mx-auto max-w-[1440px]">
        <SectionHead
          id="capabilities-title"
          title="Everything you need to collect and prove consent"
          lead="One platform for the banner your visitors see, the tags that wait for their answer, and the records you keep."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <li key={c.title} className="flex flex-col rounded-[18px] bg-white p-6">
              <IconTile icon={c.icon} />
              <h3 className="mt-5 text-[1.25rem] font-semibold tracking-[-0.02em]">{c.title}</h3>
              <p className="mt-2 text-[1rem] leading-[1.55] text-soot/80">{c.body}</p>
              <CardLink href={c.href}>{c.action}</CardLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Scan your website", body: "The cookie scanner lists what your website sets today and suggests a category for each item. Approve them in one place." },
  { title: "Design and publish your banner", body: "Pick a layout, match your brand and choose the regions and languages you need. The preview shows exactly what visitors will see." },
  { title: "Add one script tag", body: "Paste it into your website's head. Tracking waits for consent from the first page view, and consent records start arriving." },
];

/** Three steps from sign-up to live, with the real install tag. */
export function HowItWorks() {
  const snippet = `<script src="${site.url}/sdk/plain-consent.js"\n        data-site="YOUR_SITE_KEY"></script>`;
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="on-light scroll-mt-20 bg-white px-5 py-14 text-soot sm:px-8 md:py-16">
      <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <SectionHead id="how-title" title="Live in an afternoon" lead="Most websites go from sign-up to a working, compliant banner in three steps." />
          <ol className="mt-8 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soot text-[1rem] font-semibold text-white">{i + 1}</span>
                <div>
                  <h3 className="text-[1.125rem] font-semibold">{s.title}</h3>
                  <p className="mt-1 text-[1rem] leading-[1.55] text-soot/80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="min-w-0 lg:col-span-6 lg:self-center">
          <figure className="overflow-hidden rounded-[18px] bg-soot text-white">
            <figcaption className="flex items-center justify-between bg-soot-2 px-5 py-3 text-[0.875rem] text-mute">
              <span>Install</span>
              <span>Paste before &lt;/head&gt;</span>
            </figcaption>
            <pre className="overflow-x-auto px-5 py-5 text-[0.875rem] leading-[1.7]">
              <code>{snippet}</code>
            </pre>
          </figure>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {["Works on any website", "No code changes to your tags", "Undo by removing one line"].map((t) => (
              <li key={t} className="rounded-[12px] bg-chalk px-4 py-3 text-[0.9375rem] font-medium">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const LAWS = [
  {
    region: "India",
    title: "DPDP Act, 2023 and DPDP Rules, 2025",
    body: "Itemised notice, consent before processing, withdrawal as easy as giving consent, and records you can produce when asked.",
    href: "/compliance/dpdpa",
  },
  {
    region: "European Union and United Kingdom",
    title: "GDPR and UK GDPR",
    body: "Consent before non-essential cookies, Accept and Reject with equal weight, and proof of each visitor's choice.",
    href: "/compliance/gdpr",
  },
  {
    region: "California",
    title: "CCPA and CPRA",
    body: "A clear opt-out of sale and sharing, with Global Privacy Control signals honoured automatically.",
    href: "/compliance/ccpa",
  },
];

/** The laws covered, one card each, on soot. */
export function Coverage() {
  return (
    <section id="laws" aria-labelledby="laws-title" className="scroll-mt-20 bg-soot px-5 py-14 text-white sm:px-8 md:py-16">
      <div className="mx-auto max-w-[1440px]">
        <SectionHead
          id="laws-title"
          dark
          title="One setup for the laws your visitors live under"
          lead="Plain Theory detects where each visitor is and shows the notice their law requires, in their language where you have added it."
        />
        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {LAWS.map((l) => (
            <li key={l.title} className="flex flex-col rounded-[18px] bg-soot-2 p-6">
              <p className="text-[0.9375rem] text-mute">{l.region}</p>
              <h3 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.02em]">{l.title}</h3>
              <p className="mt-2 text-[1rem] leading-[1.55] text-white/85">{l.body}</p>
              <Link href={l.href} className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-4 text-[0.9375rem] font-medium text-lime hover:underline hover:underline-offset-4">
                Read the guide
                <IconArrowRight size={16} />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[0.9375rem] text-mute">Plain Theory is software, not legal advice. Your lawyer decides what your website needs.</p>
      </div>
    </section>
  );
}

/** One card per industry page. */
export function IndustriesStrip() {
  return (
    <section aria-labelledby="industries-title" className="on-light bg-white px-5 py-14 text-soot sm:px-8 md:py-16">
      <div className="mx-auto max-w-[1440px]">
        <SectionHead id="industries-title" title="Set up for your sector" lead="See what consent looks like for websites like yours, and which features matter most." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link href={l.href} className="flex h-full gap-4 rounded-[18px] bg-chalk p-6 transition-colors hover:bg-lime">
                  {Icon ? <Icon size={24} className="mt-0.5 shrink-0" /> : null}
                  <span>
                    <span className="block text-[1.125rem] font-semibold">{l.title}</span>
                    <span className="mt-1 block text-[1rem] leading-[1.5] text-soot/80">{l.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const STACK = ["Any HTML website", "WordPress", "React", "Next.js", "Vue", "Nuxt", "Svelte", "SvelteKit", "Angular", "Google Tag Manager", "Google Consent Mode v2"];

/** Where it runs: platforms and tools with install guides in the docs. */
export function Integrations() {
  return (
    <section aria-labelledby="stack-title" className="on-light bg-chalk px-5 py-12 text-soot sm:px-8">
      <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <h2 id="stack-title" className="text-[clamp(1.5rem,2.4vw,2rem)]">
            Works with your stack
          </h2>
          <Link href="/docs#frameworks" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium hover:underline hover:underline-offset-4">
            Read the install guides
            <IconArrowRight size={16} />
          </Link>
        </div>
        <ul className="flex flex-wrap gap-2 lg:col-span-8">
          {STACK.map((s) => (
            <li key={s} className="rounded-full bg-white px-4 py-2.5 text-[0.9375rem] font-medium">
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
