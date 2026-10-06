import { createHash } from "node:crypto";
import Link from "next/link";
import { IconChain, IconReceipt, IconScan, IconShieldCheck, type IconProps } from "@/components/icons";
import { DEMO_RECEIPTS, GENESIS, canonical, type DemoReceipt } from "./chain-data";

/** Build the demo chain on the server, exactly as the real log does. */
function signChain(): DemoReceipt[] {
  let prevHash = GENESIS;
  return DEMO_RECEIPTS.map((r) => {
    const unsigned = { ...r, prevHash };
    const hash = createHash("sha256").update(canonical(unsigned)).digest("hex");
    prevHash = hash;
    return { ...unsigned, hash };
  });
}

/** Public enforcement actions where the banner existed but didn't do its job. Sources cited inline. */
const FINES = [
  { who: "Healthline", amount: "$1.55M", why: "Banner shown, trackers not stopped", where: "California AG, 2025", href: "https://consently.net/blog/ccpa-enforcement-cases" },
  { who: "Tractor Supply", amount: "$1.35M", why: "Global Privacy Control ignored", where: "CPPA, 2025", href: "https://www.retailtouchpoints.com/executive-viewpoints/honda-todd-snyder-and-now-tractor-supply-whos-next-privacy-fines-put-retail-reputation-at-risk/156031/" },
  { who: "Shein", amount: "€150M", why: "Cookies set after \"Reject all\"", where: "CNIL, 2025", href: "https://www.cnil.fr/en/node/167505" },
];

const CAPABILITIES: { icon: (p: IconProps) => React.ReactNode; title: string; body: string }[] = [
  {
    icon: IconChain,
    title: "Tamper-evident consent log",
    body: "Every decision is a receipt that carries the SHA-256 hash of the one before it. Edit or delete one and the chain breaks at that exact record.",
  },
  {
    icon: IconScan,
    title: "Leak alerts from real visits",
    body: "After a visitor declines, the script watches for tracker requests that still fire and reports them, page by page, before a regulator finds them.",
  },
  {
    icon: IconReceipt,
    title: "Evidence Pack",
    body: "One export with the verified chain, the exact banner and languages shown, signals honoured and leaks found. Itself hashed, so it can't be quietly edited.",
  },
  {
    icon: IconShieldCheck,
    title: "Public daily anchors",
    body: "The last hash of each day is published, so an auditor can pin your chain independently without asking us for access.",
  },
];

const DECISION: Record<string, string> = {
  "1041": "Accepted analytics",
  "1042": "Essential only",
  "1043": "Opted out of sale",
};

/** A clean, static view of the consent log: receipts linked by their hashes, newest first. */
function ConsentLogCard({ receipts }: { receipts: DemoReceipt[] }) {
  const rows = [...receipts].reverse();
  const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
  return (
    <figure className="overflow-hidden rounded-[20px] bg-white text-ink shadow-[0_2px_4px_rgba(11,16,32,0.08),0_40px_80px_-32px_rgba(11,16,32,0.6)]">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">Consent log</p>
          <p className="text-xs text-ink-3">northwind.store</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-wash px-2.5 py-1 text-xs font-medium text-jade">
          <IconShieldCheck size={14} /> Chain verified
        </span>
      </div>
      <ol className="px-6 py-2">
        {rows.map((r, i) => (
          <li key={r.seq} className="relative flex gap-4 py-4">
            {/* chain rail */}
            <span aria-hidden className="relative flex w-3 shrink-0 justify-center">
              <span className="mt-1.5 size-2.5 rounded-full bg-brand ring-4 ring-brand-wash" />
              {i < rows.length - 1 ? <span className="absolute left-1/2 top-5 h-[calc(100%+4px)] w-px -translate-x-1/2 bg-line-strong" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-medium">
                  #{r.seq} <span className="font-normal text-ink-2">{DECISION[String(r.seq)]}</span>
                </p>
                <p className="font-mono text-xs text-ink">{short(r.hash)}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-ink-3">
                <span>{r.notice}</span>
                <span className="font-mono">links to {short(r.prevHash)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="border-t border-line bg-paper px-6 py-3.5 text-xs text-ink-2">
        Each receipt stores the hash of the one before it. Change any record and verification stops at that receipt.
      </figcaption>
    </figure>
  );
}

export function ChainProof() {
  return (
    <section id="proof" aria-labelledby="proof-title" className="relative overflow-hidden bg-ink text-white">
      {/* One soft light source from above: the only glow on the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(75,72,242,0.45),rgba(75,72,242,0))]"
      />
      <div className="container-page relative py-24 md:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="pt-reveal lg:col-span-5">
            <h2 id="proof-title" className="display text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem]">
              Don&apos;t just show a banner. Prove it worked.
            </h2>
            <p className="mt-5 max-w-[46ch] text-lg text-white/75">
              Regulators now fine banners that look compliant but don&apos;t block. Plain Theory records what happened and
              tells you when something slips through.
            </p>
          </div>

          <div className="pt-reveal lg:col-span-6 lg:col-start-7">
            <ConsentLogCard receipts={signChain()} />
          </div>
        </div>

        {/* What does the proving, in one even row */}
        <ul className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.title}>
                <span className="grid size-10 place-items-center rounded-[10px] bg-white/[0.07] text-brand-on-ink ring-1 ring-inset ring-white/10">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-base font-semibold">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/70">{c.body}</p>
              </li>
            );
          })}
        </ul>

        {/* Why it matters: enforcement against banners that didn't work */}
        <div className="mt-16 border-t border-white/10 pt-10">
          <h3 className="text-sm font-medium text-white/70">Fined for banners that didn&apos;t do their job</h3>
          <ul className="mt-5 grid gap-px overflow-hidden rounded-[14px] bg-white/10 sm:grid-cols-3">
            {FINES.map((f) => (
              <li key={f.who} className="bg-ink">
                <a href={f.href} target="_blank" rel="noreferrer" className="group block h-full p-6 transition-colors hover:bg-white/[0.03]">
                  <p className="display whitespace-nowrap text-[2rem] text-white lg:text-4xl">{f.amount}</p>
                  <p className="mt-3 text-[15px] font-medium text-white">{f.who}</p>
                  <p className="mt-1 text-sm text-white/70">{f.why}</p>
                  <p className="mt-4 text-xs text-white/55 group-hover:text-white/80">
                    {f.where}. Source <span aria-hidden>↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </p>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-white/70">
            Want the full picture?{" "}
            <Link href="/security" className="font-medium text-white underline underline-offset-4">
              How the log is built
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
