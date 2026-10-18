import Link from "next/link";
import { CodeFragment, FeatureClose, FeatureFaq, FeatureHeading, HeroActions, Rings, Stage } from "@/components/marketing/feature-page";
import type { FaqItem } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { ArrowLink, Section } from "@/components/marketing/primitives";
import { pageMetadata } from "@/lib/seo";

const PATH = "/consent-log";

export const metadata = pageMetadata({
  title: "Tamper-Evident Consent Log and Records",
  description: "Every consent choice saved as a record chained by SHA-256 to the one before, so any edit shows. Verify in one click and export an Evidence Pack for auditors.",
  path: PATH,
  socialTitle: "Proof of consent that can't be quietly edited",
  kicker: "Consent records",
});

const FAQ: FaqItem[] = [
  {
    q: "How do I prove consent to an auditor?",
    a: "Every choice is saved as a consent record that is chained to the one before it, so any later change would show. Check the whole log in one click, and download an Evidence Pack with the banner you showed and the privacy signals you honoured.",
  },
  {
    q: "Could Plain Theory change the records?",
    a: "Not without it showing. Each receipt carries the hash of the one before, so changing, inserting or removing a record breaks every link after it. The chain's daily anchors are also published, so a later rewrite of the log by anyone, including us, would no longer match them.",
  },
  {
    q: "Can an auditor verify the log without access to our systems?",
    a: "Yes. The export includes every hash, so the chain can be recomputed with standard tools. The Evidence Pack comes with a SHA-256 digest of its own contents, which anyone can recompute too.",
  },
  {
    q: "Does the consent log store personal data?",
    a: "As little as proof needs. A receipt holds a random visitor ID, the decision, the notice version and language, the time, country, device type and browser family. Raw IP addresses are never stored: they're truncated and hashed before anything is written.",
  },
  {
    q: "How long are consent records kept?",
    a: "From 90 days on the free plan to 7 years on Business, and longer on Enterprise. When old receipts are removed, a checkpoint is kept so the rest of the chain still verifies.",
    link: { href: "/pricing#compare", label: "Compare plans" },
  },
];

const RECEIPT: [string, string][] = [
  ["Decision", "Accept all, reject all, a custom choice, or a withdrawal, with each category's state."],
  ["Notice", "Which law's notice was shown, its version and the language it was shown in."],
  ["Context", "Time in UTC, country, device type and browser family."],
  ["Signals", "Whether a Global Privacy Control signal was honoured, and whether the choice came from an automated browser."],
  ["Visitor", "A random ID, not derived from a device or an account, and a truncated, salted hash in place of the IP address."],
  ["Chain", "This receipt's SHA-256 hash, the previous receipt's hash and its place in the sequence."],
];

/** One receipt, sealed and verified. Sample values. */
function ReceiptFragment() {
  const row = (k: string, v: string, strong = false) => (
    <div key={k} className="flex items-baseline justify-between gap-3 py-[5px]">
      <dt className="text-[0.8125rem] text-mute-ink">{k}</dt>
      <dd className={`text-right text-[0.8125rem] tabular-nums ${strong ? "font-semibold" : ""}`}>{v}</dd>
    </div>
  );
  return (
    <Stage tone="dark" label="One receipt, as an auditor would check it.">
      <div className="mx-auto w-full max-w-[340px] rounded-[14px] bg-white p-4 text-soot">
        <div className="flex items-center justify-between">
          <p className="text-[0.875rem] font-semibold">Consent receipt</p>
          <p className="rounded-full bg-lime px-2 py-0.5 text-[0.75rem] font-medium">Verified</p>
        </div>
        <dl className="mt-3">
          {row("Site", "shop.example.com")}
          {row("Notice", "GDPR · version 12 · English")}
          {row("Time", "15 Oct 2026, 10:42 UTC")}
        </dl>
        <dl className="mt-2 rounded-[10px] bg-chalk px-3 py-2">
          {row("Essential", "On", true)}
          {row("Preferences", "On", true)}
          {row("Analytics", "Off")}
          {row("Marketing", "Off")}
        </dl>
        <dl className="mt-2">
          {row("This receipt", "9f2c 41e0 … a71e")}
          {row("Previous", "41b0 7d2a … c93d")}
        </dl>
        <p className="mt-2 text-[0.8125rem] font-medium">Chain intact: 2,481 receipts, none changed.</p>
      </div>
    </Stage>
  );
}

/** Three receipts, each holding the hash of the one before. */
function ChainFragment() {
  const links: [number, string, string][] = [
    [2479, "6d10 e2f9", "41b0 7d2a"],
    [2480, "41b0 7d2a", "9f2c 41e0"],
    [2481, "9f2c 41e0", "e018 5b77"],
  ];
  return (
    <Stage label="Change receipt 2,480 and its hash changes, so 2,481 no longer points to it.">
      <ol className="space-y-2">
        {links.map(([seq, prev, hash], i) => (
          <li key={seq} data-reveal style={{ "--i": i } as React.CSSProperties} className="rounded-[14px] bg-white px-4 py-3">
            <p className="text-[0.875rem] font-semibold">Receipt {seq.toLocaleString("en-US")}</p>
            <dl className="mt-2 grid gap-1 text-[0.8125rem] sm:grid-cols-2">
              <div className="flex justify-between gap-3 rounded-[8px] bg-chalk px-2.5 py-1.5">
                <dt className="text-mute-ink">Previous</dt>
                <dd className="font-mono">{prev} …</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-[8px] bg-lime px-2.5 py-1.5">
                <dt>Hash</dt>
                <dd className="font-mono">{hash} …</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </Stage>
  );
}

export default function ConsentLogPage() {
  return (
    <>
      <PageHero
        tone="ink"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Consent records", href: PATH },
        ]}
        title="Proof of consent that can't be quietly edited"
        lead="Every choice a visitor makes is saved as a consent receipt, chained to the one before it, so a changed or missing record shows. Check the whole log in one click and hand an auditor one file."
        figure={<ReceiptFragment />}
      >
        <HeroActions docs="/docs#rest-api" />
      </PageHero>

      <Section id="receipt" tone="white" labelledBy="receipt-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FeatureHeading id="receipt-h" text="What every receipt holds" />
            <p className="mt-4 max-w-[40ch] text-[1rem] leading-[1.6]">
              A consent record needs to prove a decision, not identify a person. Each receipt keeps exactly that, and nothing from your pages,
              forms or cookies.
            </p>
            <div className="mt-6">
              <ArrowLink href="/security#data">How we protect it</ArrowLink>
            </div>
          </div>
          <dl className="divide-y divide-line border-y border-line lg:col-span-8">
            {RECEIPT.map(([k, v], i) => (
              <div key={k} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-1.5 py-5 md:grid-cols-[minmax(0,160px)_1fr] md:gap-8">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-[1rem] leading-[1.55] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section id="chain" tone="paper" labelledBy="chain-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <FeatureHeading id="chain-h" text="Chained, so a change shows" />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              An audit log is only useful if nobody, including us, can quietly change it. So the log is built like a ledger.
            </p>
            <Rings
              className="mt-6 max-w-[60ch]"
              items={[
                "Each receipt includes the SHA-256 hash of the previous one. Changing, inserting or removing a record breaks every link after it, and verification shows where.",
                "New receipts are written with a conditional write on the head of the chain, so two writers can never fork it.",
                "For each day, the hash of the last receipt is published as a public anchor. Record it, and you can check later that the log was never rewritten.",
                "When old receipts pass your retention period, a checkpoint keeps the remaining chain verifiable.",
              ]}
            />
          </div>
          <div className="lg:col-span-6">
            <ChainFragment />
          </div>
        </div>
      </Section>

      <Section id="evidence" tone="ink" labelledBy="evidence-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <FeatureHeading id="evidence-h" text="One click to verify. One file for the auditor." />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              Verify the whole chain from the dashboard, filter and export receipts as CSV, or print an audit report for a period.
            </p>
            <p className="mt-6 font-semibold">The Evidence Pack, on Growth and above, holds:</p>
            <Rings
              className="mt-3 max-w-[60ch]"
              items={[
                "The verification result and the daily anchors for the last 30 days.",
                "The banner your visitors saw: version, layout, notice text for each region, languages and whether Accept and Reject were equal.",
                "The purposes you ask for, the trackers you hold, and whether Google Consent Mode was on.",
                "The signals you honoured, including Global Privacy Control, and any leaks in the last 30 days.",
              ]}
            />
            <p className="mt-6 max-w-[60ch] text-[1rem] leading-[1.6] text-white/80">
              The pack carries a SHA-256 digest of its own contents, so whoever receives it can confirm nothing was changed on the way.
            </p>
          </div>
          <div className="lg:col-span-6">
            <Stage tone="dark" label="An excerpt of an Evidence Pack. Sample values.">
              <CodeFragment
                title="evidence-shop.example.com-2026-10-15.json"
                code={`{\n  "digest": "5e1a…c0d4",\n  "algorithm": "sha256(canonical-json(pack))",\n  "pack": {\n    "chain": { "ok": true, "checked": 2481 },\n    "banner": {\n      "version": 12,\n      "equalButtons": true,\n      "googleConsentMode": true\n    },\n    "signals": { "gpcHonoured": 214 }\n  }\n}`}
              />
            </Stage>
          </div>
        </div>
      </Section>

      <Section id="withdrawal" tone="white" labelledBy="withdrawal-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <FeatureHeading id="withdrawal-h" text="Withdrawals, kept as carefully as consent" />
            <p className="mt-4 max-w-[44ch] text-[1rem] leading-[1.6]">
              The DPDP Act, GDPR and CCPA all expect withdrawing to be as easy as agreeing. The log treats a withdrawal as its own receipt.
            </p>
            <div className="mt-6 flex flex-col items-start gap-3">
              <ArrowLink href="/compliance/dpdpa">DPDP Act guide</ArrowLink>
              <ArrowLink href="/compliance/gdpr">GDPR guide</ArrowLink>
              <ArrowLink href="/compliance/ccpa">CCPA guide</ArrowLink>
            </div>
          </div>
          <dl className="divide-y divide-line border-y border-line lg:col-span-7">
            {[
              ["A receipt for every change", "Changing preferences writes a new receipt to the chain. Withdrawing writes a withdrawal receipt and shows the banner again."],
              ["The visitor's own history", "A visitor's choices and their hashes can be fetched for that visitor, so you can show them what they agreed to."],
              ["Withdrawals to your tools", "On Business and above, signed webhooks send each withdrawal to your CRM and other tools."],
              ["Stored in one place", "Receipts stay in a single data region, encrypted at rest and in transit. Dedicated data residency is available on Enterprise."],
            ].map(([k, v], i) => (
              <div key={k} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-1.5 py-5 md:grid-cols-[minmax(0,200px)_1fr] md:gap-8">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-[1rem] leading-[1.55] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-10 max-w-[70ch] text-[1rem] leading-[1.6] text-mute-ink">
          Receipts come from the{" "}
          <Link href="/cookie-consent" className="mk-link font-medium text-soot">
            consent banner
          </Link>{" "}
          or your own interface in headless mode, the trackers they cover come from the{" "}
          <Link href="/cookie-scanner" className="mk-link font-medium text-soot">
            cookie scanner
          </Link>
          , and the same choice drives{" "}
          <Link href="/google-consent-mode" className="mk-link font-medium text-soot">
            Google Consent Mode v2
          </Link>
          .
        </p>
      </Section>

      <FeatureFaq items={FAQ} />
      <FeatureClose current={PATH} />
    </>
  );
}
