"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { cascadeIn, gsap, reducedMotion } from "@/lib/motion";
import { IconCheck, IconChevronRight } from "@/components/icons";
import { CDN } from "../docs/framework-snippets";
import { IconCalifornia, IconChakra, IconEuStars, IconUkCross } from "./coverage-icons";

type Signal = "granted" | "denied";
type ConsentModeKey = "ad_storage" | "analytics_storage" | "ad_user_data" | "ad_personalization";

interface RegionNotice {
  id: string;
  label: string;
  law: string;
  model: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** where the demo visitor is browsing from */
  visitor: string;
  rules: string[];
  banner: { lang: string; title: string; body: string; actions: string[] };
  /** Consent Mode v2 defaults before the visitor chooses */
  signals: Record<ConsentModeKey, Signal>;
  href: string;
}

const DENIED: Record<ConsentModeKey, Signal> = { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const GRANTED: Record<ConsentModeKey, Signal> = { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" };

const REGIONS: RegionNotice[] = [
  {
    id: "eu",
    label: "European Union",
    law: "GDPR and ePrivacy",
    model: "Opt-in",
    icon: IconEuStars,
    visitor: "Paris",
    rules: ["Analytics and ad tags are held until the visitor agrees", "Reject all on the first layer, as easy as Accept all", "Choices per purpose, withdrawable at any time"],
    banner: {
      lang: "en",
      title: "Your privacy choices",
      body: "We'd like to use analytics and advertising cookies. Nothing runs unless you agree.",
      actions: ["Reject all", "Customise", "Accept all"],
    },
    signals: DENIED,
    href: "/compliance/gdpr",
  },
  {
    id: "uk",
    label: "United Kingdom",
    law: "UK GDPR and PECR",
    model: "Opt-in",
    icon: IconUkCross,
    visitor: "Manchester",
    rules: ["Non-essential cookies wait for consent", "Equal-weight Accept and Reject buttons", "A link to change choices on every page"],
    banner: {
      lang: "en-GB",
      title: "Cookies on this site",
      body: "We use essential cookies to run the site, and others only with your permission.",
      actions: ["Reject all", "Settings", "Accept all"],
    },
    signals: DENIED,
    href: "/compliance/gdpr",
  },
  {
    id: "ca",
    label: "California",
    law: "CCPA/CPRA",
    model: "Opt-out",
    icon: IconCalifornia,
    visitor: "San Francisco",
    rules: ["Tags run until the visitor opts out of sale or sharing", "A “Do Not Sell or Share” link, always one step", "Global Privacy Control applied as an opt-out automatically"],
    banner: {
      lang: "en-US",
      title: "Your privacy choices",
      body: "We share some data with advertising partners. You can opt out at any time.",
      actions: ["Do Not Sell or Share My Personal Information"],
    },
    signals: GRANTED,
    href: "/compliance/ccpa",
  },
  {
    id: "in",
    label: "India",
    law: "DPDP Act, 2023",
    model: "Opt-in, itemised",
    icon: IconChakra,
    visitor: "Bengaluru",
    rules: [
      "Each purpose listed, in English or any of 22 Indian languages",
      "Consent by a clear action; withdrawing is as easy as giving",
      "Grievance and Data Protection Officer contact on the notice",
    ],
    banner: {
      lang: "hi",
      title: "आपकी गोपनीयता",
      body: "हम आपकी सहमति से ही एनालिटिक्स और विज्ञापन कुकीज़ का उपयोग करते हैं।",
      actions: ["अस्वीकार करें", "विकल्प", "स्वीकार करें"],
    },
    signals: DENIED,
    href: "/compliance/dpdpa",
  },
];

function SignalRow({ name, value }: { name: string; value: Signal }) {
  const granted = value === "granted";
  const chip = useRef<HTMLSpanElement>(null);
  const last = useRef(value);
  // When a signal flips (e.g. GPC turns on), the chip pops so the change is noticed.
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    if (chip.current && !reducedMotion()) gsap.fromTo(chip.current, { scale: 0.6 }, { scale: 1, duration: 0.6, ease: "back.out(3)" });
  }, [value]);
  return (
    <li data-anim className="flex items-center justify-between gap-3 py-2">
      <code className="truncate font-mono text-[12px] text-ink-2">{name}</code>
      <span
        ref={chip}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-300 ${
          granted ? "bg-jade-wash text-jade" : "bg-amber-wash text-amber"
        }`}
      >
        <span aria-hidden className={`size-1.5 rounded-full ${granted ? "bg-jade-bright" : "bg-amber-bright"}`} />
        {value}
      </span>
    </li>
  );
}

/**
 * Pick where a visitor is and see what the same script shows them: the law that applies, the banner,
 * and the Consent Mode signals sent to Google tags. California adds a Global Privacy Control switch.
 */
export function NoticeExplorer({ sizeLabel }: { sizeLabel: string }) {
  const [active, setActive] = useState(0);
  const [gpc, setGpc] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();
  const r = REGIONS[active];
  const optedOut = r.id === "ca" && gpc;
  const signals: Record<ConsentModeKey, Signal> = optedOut ? { ...r.signals, ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" } : r.signals;
  const panel = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);

  // A new region cascades in: banner, rules, then the signals.
  useLayoutEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    cascadeIn(panel.current, { y: 12, stagger: 0.04 });
  }, [active]);

  // GPC on or off: the banner's contents cross-fade to the opt-out confirmation and back.
  const banner = useRef<HTMLDivElement>(null);
  const lastOptOut = useRef(optedOut);
  useLayoutEffect(() => {
    if (lastOptOut.current === optedOut) return;
    lastOptOut.current = optedOut;
    cascadeIn(banner.current, { y: 8, selector: ":scope > *" });
  }, [optedOut]);

  /** Select a region; on phones the chip row scrolls so the chosen one is fully visible. */
  const choose = (n: number, focus: boolean) => {
    setActive(n);
    const el = tabs.current[n];
    if (focus) el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };
  const select = (i: number) => choose((i + REGIONS.length) % REGIONS.length, true);

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      {/* Where the visitor is */}
      <div className="min-w-0 lg:col-span-5">
        <p id={`${uid}-tabs-label`} className="text-sm font-medium text-ink-3">
          Where is your visitor?
        </p>
        <div
          role="tablist"
          aria-labelledby={`${uid}-tabs-label`}
          aria-orientation="vertical"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowRight") select(active + 1);
            else if (e.key === "ArrowUp" || e.key === "ArrowLeft") select(active - 1);
            else if (e.key === "Home") select(0);
            else if (e.key === "End") select(REGIONS.length - 1);
            else return;
            e.preventDefault();
          }}
          className="-mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {REGIONS.map((reg, i) => {
            const selected = i === active;
            const Icon = reg.icon;
            return (
              <button
                key={reg.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`${uid}-tab-${reg.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(i, false)}
                className={`group flex shrink-0 snap-start items-center gap-3 rounded-[16px] p-3 text-left ring-1 transition-[background-color,box-shadow] duration-300 ease-[var(--ease-spring)] lg:p-4 ${
                  selected ? "bg-surface shadow-[0_18px_40px_-26px_rgba(11,16,32,0.45)] ring-2 ring-brand" : "bg-surface/60 ring-line hover:bg-surface hover:ring-line-strong"
                }`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-[11px] ring-1 ring-inset transition-colors lg:size-11 ${
                    selected ? "bg-brand text-white ring-brand" : "bg-paper text-ink-2 ring-line"
                  }`}
                >
                  <Icon />
                </span>
                <span className="min-w-0 pr-1">
                  <span className="block whitespace-nowrap text-[15px] font-semibold text-ink">{reg.label}</span>
                  <span className="block whitespace-nowrap text-[13px] text-ink-3">
                    {reg.law} · {reg.model}
                  </span>
                </span>
                <IconChevronRight size={16} className={`ml-auto hidden shrink-0 transition-[opacity,transform] duration-300 lg:block ${selected ? "translate-x-0 text-brand opacity-100" : "-translate-x-1 opacity-0"}`} />
              </button>
            );
          })}
        </div>

        <div className="mt-6 hidden rounded-[16px] bg-ink p-5 text-white lg:block">
          <p className="text-xs text-white/60">The same tag, everywhere ({sizeLabel})</p>
          <pre className="mt-3 whitespace-pre-wrap break-all font-mono text-[12.5px] leading-relaxed text-white/90">
            <code>
              <span className="text-brand-on-ink">&lt;script</span> src=&quot;{CDN}&quot;{"\n"}
              {"        "}data-site=&quot;pk_live_…&quot;<span className="text-brand-on-ink">&gt;&lt;/script&gt;</span>
            </code>
          </pre>
        </div>
      </div>

      {/* What they get */}
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${r.id}`} className="min-w-0 lg:col-span-7">
        <div className="overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-window)]">
          <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-2.5">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </span>
            <span className="min-w-0 flex-1 truncate text-center text-xs text-ink-3">
              shop.example · visitor in <span className="font-medium text-ink-2">{r.visitor}</span>
            </span>
          </div>

          <div ref={panel} className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {/* The banner they see */}
            <div>
              <p className="text-xs font-medium text-ink-3">What they see</p>
              <div ref={banner} data-anim lang={r.banner.lang} className="mt-3 rounded-[14px] bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-line">
                {optedOut ? (
                  <p className="flex items-start gap-2 text-sm text-ink" lang="en">
                    <IconCheck size={16} className="mt-0.5 shrink-0 text-jade" />
                    Opt-out signal received. You&apos;ve been opted out of sale and sharing on this site.
                  </p>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold text-ink">{r.banner.title}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{r.banner.body}</p>
                    <div className={`mt-4 grid gap-2 ${r.banner.actions.length === 3 ? "grid-cols-3" : "grid-cols-1"}`} aria-hidden>
                      {r.banner.actions.map((a, i) => (
                        <span
                          key={a}
                          className={`flex min-h-9 items-center justify-center rounded-[9px] px-2 text-center text-[12px] font-semibold leading-tight ${
                            r.banner.actions.length === 3 && i !== 1 ? "bg-brand text-white" : r.banner.actions.length === 1 ? "text-brand underline underline-offset-2" : "bg-paper text-ink ring-1 ring-inset ring-line-strong"
                          }`}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {r.id === "in" ? <p className="mt-2 text-xs text-ink-3">Shown in Hindi because the browser asks for it. English is always one tap away.</p> : null}
              {r.id === "ca" ? (
                <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[12px] bg-paper px-3 py-2 ring-1 ring-inset ring-line">
                  <span className="text-sm text-ink-2">
                    Browser sends <span className="font-medium text-ink">Global Privacy Control</span>
                  </span>
                  <input type="checkbox" role="switch" checked={gpc} onChange={(e) => setGpc(e.target.checked)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className="relative h-6 w-10 shrink-0 rounded-full bg-line-strong transition-colors duration-300 peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-300 after:ease-[var(--ease-spring)] peer-checked:after:translate-x-4"
                  />
                </label>
              ) : null}

              <ul className="mt-5 space-y-2.5">
                {r.rules.map((rule) => (
                  <li key={rule} data-anim className="flex gap-2.5 text-sm text-ink-2">
                    <IconCheck size={16} className="mt-0.5 shrink-0 text-jade" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* What their tags are told */}
            <div className="md:border-l md:border-line md:pl-6">
              <p className="text-xs font-medium text-ink-3">Google Consent Mode v2, before they choose</p>
              <ul className="mt-2 divide-y divide-line" aria-live="polite">
                {(Object.keys(signals) as ConsentModeKey[]).map((k) => (
                  <SignalRow key={k} name={k} value={signals[k]} />
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-3">
                {r.id === "ca"
                  ? optedOut
                    ? "GPC is treated as an opt-out of sale and sharing, and recorded on the visitor's receipt."
                    : "Opt-out law: tags may run until the visitor opts out, or their browser does it for them."
                  : "Held until the visitor agrees. Updated the moment they choose, and recorded on their receipt."}
              </p>
              <Link href={r.href} className="mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:underline md:min-h-0">
                How we handle {r.law.split(" ")[0]}
                <IconChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
