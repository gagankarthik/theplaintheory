import Link from "next/link";
import { BANNER_SCENE, BLOCKING_SCENE, IsoScene, LEDGER_SCENE, REGIONS_SCENE, type SceneItem } from "@/components/illustrations/iso-scene";
import { FRAMEWORK_LOGOS } from "../framework-logos";
import { ArrowLink, Section, SectionIntro } from "../primitives";

interface Module {
  title: string;
  body: string;
  link: { href: string; label: string };
  scene: { items: SceneItem[]; label: string };
  /** wide cells span two columns on large screens and sit the illustration beside the text */
  wide?: boolean;
}

/**
 * What the product does, in the order a visitor experiences it: the notice they see, the scripts
 * that wait, the rules that pick the notice, and the record that's kept. The scanner and analytics
 * are shown in the product tour, not repeated here.
 */
const MODULES: Module[] = [
  {
    title: "Consent banner",
    body: "A bar, a centred modal or a corner notice in your colours and type. Accept and reject carry equal weight, so nobody is nudged.",
    link: { href: "/docs#banner", label: "Banner options" },
    scene: { items: BANNER_SCENE, label: "A consent banner lifted off a web page" },
    wide: true,
  },
  {
    title: "Tracker blocking",
    body: "Analytics and ad scripts wait in place and run the moment someone agrees. Nothing loads early.",
    link: { href: "/docs#blocking", label: "How blocking works" },
    scene: { items: BLOCKING_SCENE, label: "Three trackers, one released and two held" },
  },
  {
    title: "Region rules",
    body: "GDPR opt-in in Europe, an opt-out in California and a DPDPA notice in India, decided at the edge for each visitor.",
    link: { href: "/docs#regions", label: "Region mapping" },
    scene: { items: REGIONS_SCENE, label: "Three regions at different heights on one grid" },
  },
  {
    title: "Consent log",
    body: "Every decision becomes a receipt linked to the one before it by a SHA-256 hash. Change any record and verification shows exactly where.",
    link: { href: "#proof", label: "Try breaking the chain" },
    scene: { items: LEDGER_SCENE, label: "Receipts stacked and linked into a chain" },
    wide: true,
  },
];

const SNIPPET = `import { PlainConsentProvider, ConsentGate } from "@plaintheory/react";

<PlainConsentProvider siteKey="pk_live_7Hq">
  <ConsentGate category="analytics">
    <Analytics />
  </ConsentGate>
</PlainConsentProvider>`;

function ModuleCell({ m }: { m: Module }) {
  return (
    <li className={`group flex flex-col bg-surface ${m.wide ? "lg:col-span-2" : ""}`}>
      <div className={`flex h-full flex-col p-7 md:p-9 ${m.wide ? "lg:flex-row lg:items-center lg:gap-10" : ""}`}>
        <div className={`flex items-center justify-center ${m.wide ? "order-last mt-8 lg:mt-0 lg:w-[44%]" : "mb-8 h-36"}`}>
          <IsoScene items={m.scene.items} label={m.scene.label} className={m.wide ? "h-44 w-full max-w-[300px]" : "h-full max-h-36 w-auto max-w-[220px]"} />
        </div>
        <div className="flex flex-1 flex-col">
          <h3 className="text-xl font-semibold">{m.title}</h3>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">{m.body}</p>
          <div className="mt-auto pt-6">
            <ArrowLink href={m.link.href} className="text-ink">
              {m.link.label}
            </ArrowLink>
          </div>
        </div>
      </div>
    </li>
  );
}

export function PlatformGrid() {
  return (
    <Section id="platform" tone="paper" labelledBy="platform-title">
      <SectionIntro
        id="platform-title"
        align="left"
        title="One platform, from the banner to the audit"
        lead="Each part shares the same configuration, the same receipts and the same API. Turn on what you need today and the rest is already wired."
      />
      <ul className="pt-reveal mt-14 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line md:mt-16 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <ModuleCell key={m.title} m={m} />
        ))}

        {/* Developers: the integration itself is the illustration */}
        <li className="bg-ink text-white md:col-span-2 lg:col-span-3">
          <div className="grid gap-8 p-7 md:p-9 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className="lg:col-span-5">
              <h3 className="text-xl font-semibold">Built for your stack</h3>
              <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-white/75">
                One script tag for any site, a WordPress plugin, or typed packages for React, Next.js, Vue, Svelte and Angular. Headless mode lets
                you render your own banner while we handle blocking and receipts.
              </p>
              <ul className="mt-7 grid max-w-[420px] grid-cols-4 gap-2.5" aria-label="Works with">
                {FRAMEWORK_LOGOS.map((f) => (
                  <li key={f.name} className="group flex flex-col items-center gap-2 rounded-[12px] bg-white/[0.04] px-2 pb-2.5 pt-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.08]">
                    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden className="fill-white/80 transition-colors group-hover:fill-white">
                      <path d={f.path} />
                    </svg>
                    <span className="text-[11px] text-white/70 group-hover:text-white">{f.name}</span>
                  </li>
                ))}
              </ul>
              <Link href="/docs#frameworks" className="mt-8 inline-flex text-sm font-medium text-white link-draw">
                Read the framework guides
              </Link>
            </div>
            <figure className="lg:col-span-7">
              <div className="overflow-hidden rounded-[12px] bg-ink-raised ring-1 ring-white/10">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-white/70">
                  <span className="font-mono">app/layout.tsx</span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/90">
                  <code>{SNIPPET}</code>
                </pre>
              </div>
              <figcaption className="sr-only">Wrapping analytics in a consent gate with the React package</figcaption>
            </figure>
          </div>
        </li>
      </ul>
    </Section>
  );
}
