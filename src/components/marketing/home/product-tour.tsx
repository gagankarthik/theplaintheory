"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { IconCheck, IconLayoutBar, IconLayoutModal, IconLayoutToast } from "@/components/icons";
import { Section, SectionIntro, StatusDot } from "../primitives";

const DURATION = 8000;

interface Step {
  id: string;
  title: string;
  body: string;
  points: string[];
  panel: () => React.JSX.Element;
}

/* ---------- panels: product screens with believable data ---------- */

function BuilderPanel() {
  const swatches = ["var(--color-brand)", "var(--color-ink)", "var(--color-jade)", "var(--color-rose)"];
  return (
    <div className="grid h-full md:grid-cols-[230px_1fr]">
      <div className="space-y-6 border-b border-line p-5 md:border-b-0 md:border-r">
        <div>
          <p className="text-xs font-medium text-ink-3">Layout</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[IconLayoutBar, IconLayoutModal, IconLayoutToast].map((I, i) => (
              <span key={i} className={`grid h-11 place-items-center rounded-[8px] ${i === 0 ? "bg-brand-wash text-brand ring-1 ring-brand" : "text-ink-3 ring-1 ring-line"}`}>
                <I size={20} />
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-3">Accent</p>
          <div className="mt-2 flex gap-2">
            {swatches.map((c, i) => (
              <span key={c} className={`size-7 rounded-full ${i === 0 ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-jade">
            <IconCheck size={14} /> Contrast 7.9 : 1, passes AA
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Equal-weight buttons</span>
          <span className="relative h-5 w-9 rounded-full bg-brand">
            <span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-white" />
          </span>
        </div>
      </div>
      <div className="relative min-h-[260px] bg-paper p-5 md:min-h-0">
        <div className="space-y-2.5" aria-hidden>
          <span className="block h-3 w-1/3 rounded bg-line-strong" />
          <span className="block h-2 w-2/3 rounded-full bg-line" />
          <span className="block h-2 w-1/2 rounded-full bg-line" />
        </div>
        <div className="absolute inset-x-5 bottom-5 rounded-[10px] bg-white p-4 shadow-[var(--shadow-lift)] ring-1 ring-line">
          <p className="text-sm font-semibold">Your choice about cookies</p>
          <p className="mt-1 text-xs text-ink-2">Essential cookies run this site. With your permission we&apos;d also use analytics.</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <span className="grid h-8 place-items-center rounded-md bg-brand text-xs text-white">Reject all</span>
            <span className="grid h-8 place-items-center rounded-md text-xs ring-1 ring-line-strong">Choose</span>
            <span className="grid h-8 place-items-center rounded-md bg-brand text-xs text-white">Accept all</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScanPanel() {
  const rows = [
    { name: "Google Analytics 4", host: "googletagmanager.com/gtag", cat: "Analytics", found: "All 10 pages" },
    { name: "Meta Pixel", host: "connect.facebook.net", cat: "Marketing", found: "Checkout, home" },
    { name: "Hotjar", host: "static.hotjar.com", cat: "Analytics", found: "Product pages" },
    { name: "Intercom", host: "widget.intercom.io", cat: "Preferences", found: "All 10 pages" },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-sm font-semibold">northwind.store</p>
          <p className="text-xs text-ink-3">Scanned 10 pages in 18 seconds</p>
        </div>
        <span className="rounded-full bg-amber-wash px-2.5 py-1 text-xs font-medium text-amber">4 trackers need a category</span>
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Trackers found by the scanner</caption>
        <thead className="text-xs text-ink-3">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-2.5 font-medium">Script</th>
            <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">Found on</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-5 py-3">
                <span className="block font-medium">{r.name}</span>
                <span className="block font-mono text-[11px] text-ink-3">{r.host}</span>
              </td>
              <td className="hidden px-5 py-3 text-ink-2 sm:table-cell">{r.found}</td>
              <td className="px-5 py-3 text-right">
                <span className="inline-flex h-7 items-center rounded-md px-2.5 text-xs ring-1 ring-line-strong">{r.cat}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogPanel() {
  const rows = [
    { t: "11:42:08", v: "v_8f2c", d: "Accepted all", s: "released" as const, n: "GDPR", c: "DE", h: "9f2c41e0…e41a" },
    { t: "11:41:55", v: "v_31ab", d: "Essential only", s: "declined" as const, n: "DPDPA", c: "IN", h: "07bd88c2…c3f0" },
    { t: "11:41:20", v: "v_c70e", d: "Chose categories", s: "held" as const, n: "GDPR", c: "FR", h: "b1d4907a…22d9" },
    { t: "11:40:47", v: "v_5e19", d: "Opted out of sale", s: "declined" as const, n: "CCPA", c: "US", h: "4ac0e3f1…9b07" },
  ];
  return (
    <div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Recent consent receipts</caption>
        <thead className="text-xs text-ink-3">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-3 font-medium">Time (UTC)</th>
            <th scope="col" className="px-5 py-3 font-medium">Decision</th>
            <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">Notice</th>
            <th scope="col" className="hidden px-5 py-3 text-right font-medium md:table-cell">Hash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.v}>
              <td className="px-5 py-3 tabular-nums text-ink-2">{r.t}</td>
              <td className="px-5 py-3">
                <StatusDot state={r.s}>{r.d}</StatusDot>
              </td>
              <td className="hidden px-5 py-3 text-ink-2 sm:table-cell">
                {r.n}, {r.c}
              </td>
              <td className="hidden px-5 py-3 text-right font-mono text-xs text-ink-3 md:table-cell">{r.h}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-jade-wash/60 px-5 py-3.5 text-sm">
        <span className="flex items-center gap-2 text-jade">
          <IconCheck size={16} /> Chain verified: 3,542 receipts, no breaks
        </span>
        <span className="text-xs text-ink-3">Export CSV or audit report</span>
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    id: "builder",
    title: "Design the banner",
    body: "Change layout, colours and copy and see the real banner update as you go.",
    points: ["Contrast checked against WCAG AA", "Equal-weight buttons by default", "Copy per region and language"],
    panel: BuilderPanel,
  },
  {
    id: "scan",
    title: "Find every tracker",
    body: "The scanner crawls your pages and lists the scripts it finds, ready to sort into categories.",
    points: ["Matches known trackers automatically", "Shows which pages load each one", "Re-scan whenever you ship"],
    panel: ScanPanel,
  },
  {
    id: "log",
    title: "Prove every decision",
    body: "Each choice is a receipt your DPO can filter, verify and export for an audit.",
    points: ["IP addresses truncated and hashed", "Verify the whole chain in one click", "CSV export and a printable report"],
    panel: LogPanel,
  },
];

export function ProductTour() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [cycle, setCycle] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const autoplay = playing && !reduce;

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(() => {
      setActive((a) => (a + 1) % STEPS.length);
      setCycle((c) => c + 1);
    }, DURATION);
    return () => window.clearTimeout(t);
  }, [autoplay, active, cycle]);

  const select = (i: number, focus = false) => {
    setActive(i);
    setPlaying(false);
    if (focus) tabs.current[i]?.focus();
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const last = STEPS.length - 1;
    const next = { ArrowDown: i === last ? 0 : i + 1, ArrowUp: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next, true);
  };

  const Panel = STEPS[active].panel;

  return (
    <Section id="tour" tone="paper" labelledBy="tour-title">
      <SectionIntro
        id="tour-title"
        align="left"
        title="What your team sees on the other side"
        lead="Visitors get a clear notice. Your team gets a builder, a scanner and a log, in one dashboard that a developer, a marketer and a DPO can all use."
      />

      <div className="mt-14 grid gap-10 md:mt-16 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <div role="tablist" aria-orientation="vertical" aria-label="Product tour" className="border-l border-line">
            {STEPS.map((s, i) => {
              const selected = i === active;
              return (
                <div key={s.id} className="relative">
                  {selected ? (
                    <span
                      aria-hidden
                      key={`${cycle}-${autoplay}`}
                      className="absolute -left-px top-0 h-full w-0.5 bg-ink"
                      style={autoplay ? { animation: `pt-progress ${DURATION}ms linear both` } : undefined}
                    />
                  ) : null}
                  <button
                    ref={(el) => {
                      tabs.current[i] = el;
                    }}
                    role="tab"
                    id={`${baseId}-tab-${s.id}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => select(i)}
                    onKeyDown={(e) => onKey(e, i)}
                    className="block w-full py-4 pl-6 pr-2 text-left"
                  >
                    <span className={`block text-lg font-semibold transition-colors ${selected ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}>
                      {s.title}
                    </span>
                  </button>
                  {selected ? (
                    <div className="pb-5 pl-6 pr-2">
                      <p className="text-[15px] text-ink-2">{s.body}</p>
                      <ul className="mt-4 space-y-2">
                        {s.points.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-sm text-ink-2">
                            <IconCheck size={16} className="mt-0.5 shrink-0 text-jade" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!reduce ? (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause the tour" : "Play the tour"}
              className="mt-6 inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-ink)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                {playing ? <path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" /> : <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />}
              </svg>
              {playing ? "Pause" : "Play"}
            </button>
          ) : null}
        </div>

        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${STEPS[active].id}`}
          tabIndex={0}
          className="lg:col-span-7"
        >
          <div className="rounded-[var(--radius-xl)] bg-surface/70 p-2.5 ring-1 ring-inset ring-line sm:p-4">
            <div key={STEPS[active].id} className="pt-enter-up grid min-h-[360px] overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-lift)] ring-1 ring-line">
              <Panel />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
