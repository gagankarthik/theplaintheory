"use client";

import type { ReactNode } from "react";

export interface KpiDelta {
  /** change in the metric's own unit, e.g. +0.031 for +3.1 percentage points */
  change: number;
  /** which direction is good for this metric; "neutral" never colors the change */
  goodWhen: "up" | "down" | "neutral";
  /** e.g. "vs previous 30 days" */
  period: string;
  /** formats the absolute change, e.g. n => `${(n*100).toFixed(1)} pts` */
  format: (n: number) => string;
}

/** Delta as text with a small direction glyph. Color only signals good (jade) or bad (rose) for the user. */
export function DeltaText({ d }: { d: KpiDelta }) {
  const flat = Math.abs(d.change) < 0.0005;
  const up = d.change > 0;
  const good = flat || d.goodWhen === "neutral" ? null : up === (d.goodWhen === "up");
  const color = good === null ? "text-ink-3" : good ? "text-jade" : "text-rose";
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs">
      <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${color}`}>
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className={!flat && !up ? "rotate-180" : ""}>
          {flat ? <path d="M1 5h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /> : <path d="M5 1.5L9 8H1z" fill="currentColor" />}
        </svg>
        {flat ? "No change" : `${up ? "+" : "−"}${d.format(Math.abs(d.change))}`}
      </span>
      <span className="text-ink-3">{d.period}</span>
      {good === null ? null : <span className="sr-only">({good ? "an improvement" : "a decline"})</span>}
    </span>
  );
}

/**
 * Quiet KPI tile: label, tabular number, delta in words. Meant to sit in a divided row, not as a card.
 * With `onSelect` it is a toggle (aria-pressed) that picks the metric the main chart shows.
 */
export function KpiTile({
  label,
  value,
  detail,
  delta,
  selected,
  onSelect,
  controls,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  delta?: KpiDelta;
  selected?: boolean;
  onSelect?: () => void;
  controls?: string;
}) {
  const body = (
    <>
      <span className="block text-sm text-ink-2">{label}</span>
      <span className="mt-1.5 block text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums">{value}</span>
      {delta ? (
        <span className="mt-2 block">
          <DeltaText d={delta} />
        </span>
      ) : null}
      {detail ? <span className="mt-1 block text-xs text-ink-3">{detail}</span> : null}
    </>
  );

  if (!onSelect) return <div className="bg-surface px-5 py-5">{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-controls={controls}
      onClick={onSelect}
      className={`relative block h-full w-full px-5 py-5 text-left transition-colors bg-surface ${selected ? "" : "hover:bg-paper"}`}
    >
      {body}
      <span aria-hidden className={`absolute inset-x-5 bottom-0 h-[2px] rounded-full bg-brand transition-opacity ${selected ? "opacity-100" : "opacity-0"}`} />
    </button>
  );
}
