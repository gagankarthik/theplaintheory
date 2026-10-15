"use client";

import { useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CATEGORY_RATES,
  METRICS,
  OUTCOMES,
  formatInt,
  formatPct,
  formatPts,
  type BreakdownRow,
  type DayPoint,
  type MetricId,
  type Summary,
} from "@/lib/analytics";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DeltaText, KpiTile } from "@/components/app/ui/kpi-tile";
import { Skeleton } from "@/components/app/ui/skeleton";
import { Segmented } from "@/components/app/ui/tabs";

const fmtDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Same size as the plot it stands in for, so the panel doesn't jump when Recharts arrives. */
function PlotSkeleton() {
  return <Skeleton className="h-full w-full !rounded-md" />;
}

// Recharts is loaded on the client only, after the page's own JavaScript (plots.tsx).
const MetricLinePlot = dynamic(() => import("./plots").then((m) => m.MetricLinePlot), { ssr: false, loading: PlotSkeleton });
const DecisionBarsPlot = dynamic(() => import("./plots").then((m) => m.DecisionBarsPlot), { ssr: false, loading: PlotSkeleton });

function ViewToggle({ value, onChange }: { value: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <Segmented
      size="sm"
      label="Display as"
      value={value}
      onChange={onChange}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "Table" },
      ]}
    />
  );
}

/* ---------------- KPI row + metric trend ---------------- */

export interface PreviousRates {
  optIn: number | null;
  optOut: number | null;
  partial: number | null;
  bounce: number | null;
}

export function MetricOverview({ current, previous, range }: { current: Summary; previous: PreviousRates; range: number }) {
  const [metric, setMetric] = useState<MetricId>("optIn");
  const [view, setView] = useState<"chart" | "table">("chart");
  const chartId = useId();
  const m = METRICS[metric];

  const totals: Record<MetricId, { value: number; detail: string; has: boolean }> = {
    optIn: { value: current.optInRate, detail: `${formatInt(current.accepted)} of ${formatInt(current.decisions)} decisions`, has: current.decisions > 0 },
    optOut: { value: current.optOutRate, detail: `${formatInt(current.rejected)} rejected all`, has: current.decisions > 0 },
    partial: { value: current.partialRate, detail: `${formatInt(current.partial)} chose some`, has: current.decisions > 0 },
    bounce: { value: current.bounceRate, detail: `${formatInt(current.bounces)} of ${formatInt(current.views)} banner views`, has: current.views > 0 },
  };

  const points = useMemo(() => current.series.map((p) => ({ day: p.day, value: m.of(p) })), [current.series, m]);
  const valid = points.filter((p): p is { day: string; value: number } => p.value !== null);
  const lo = valid.reduce<(typeof valid)[number] | null>((a, p) => (!a || p.value < a.value ? p : a), null);
  const hi = valid.reduce<(typeof valid)[number] | null>((a, p) => (!a || p.value > a.value ? p : a), null);
  const last = valid[valid.length - 1];

  return (
    <Card aria-labelledby={`${chartId}-h`} className="overflow-hidden">
      <h2 id={`${chartId}-h`} className="sr-only">
        Consent trend
      </h2>
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line xl:grid-cols-4">
        {(Object.keys(METRICS) as MetricId[]).map((id) => {
          const t = totals[id];
          const prev = previous[id];
          return (
            <KpiTile
              key={id}
              label={METRICS[id].label}
              value={t.has ? formatPct(t.value) : "No data"}
              detail={t.detail}
              selected={metric === id}
              onSelect={() => setMetric(id)}
              controls={chartId}
              delta={
                t.has && prev !== null
                  ? { change: t.value - prev, goodWhen: METRICS[id].goodWhen, period: `vs previous ${range} days`, format: formatPts }
                  : undefined
              }
            />
          );
        })}
      </div>

      <div id={chartId} className="px-5 py-5 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{m.label} by day</h3>
            <p className="mt-1 text-sm text-ink-3">
              {m.describe}, by UTC day.{" "}
              <Link href="/docs#analytics" className="text-ink-2 underline underline-offset-4 hover:text-ink">
                How it&apos;s counted
              </Link>
            </p>
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <p className="sr-only" aria-live="polite">
          {valid.length
            ? `${m.label} over the last ${range} days: ${formatPct(totals[metric].value)} overall, lowest ${formatPct(lo!.value)} on ${fmtDay(lo!.day)}, highest ${formatPct(hi!.value)} on ${fmtDay(hi!.day)}.`
            : `No ${m.label.toLowerCase()} data in this range.`}
        </p>

        {view === "chart" ? (
          <div className="h-64 w-full" aria-hidden={valid.length === 0}>
            <MetricLinePlot points={points} color={m.color} label={m.label} last={last ?? null} />
          </div>
        ) : (
          <DayTable
            caption={`${m.label} by day`}
            rows={points.map((p) => ({ day: p.day, cells: [p.value === null ? "No data" : formatPct(p.value)] }))}
            headers={[m.label]}
          />
        )}
      </div>
    </Card>
  );
}

/* ---------------- decision volume ---------------- */

function OutcomeLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
      {OUTCOMES.map((o) => (
        <li key={o.id} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: o.color }} aria-hidden />
          {o.label}
        </li>
      ))}
    </ul>
  );
}

function DayTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: { day: string; cells: string[] }[] }) {
  return (
    <div className="scroll-thin max-h-72 overflow-auto rounded-md border border-line" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-raised text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Day
            </th>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-right font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...rows].reverse().map((r) => (
            <tr key={r.day} className="hover:bg-raised">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                {fmtDay(r.day)}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} className="px-3 py-1.5 text-right tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionsChart({ series }: { series: DayPoint[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  const total = series.reduce((s, d) => s + d.accepted + d.partial + d.rejected, 0);
  const busiest = series.reduce((a, d) => (d.accepted + d.partial + d.rejected > a.accepted + a.partial + a.rejected ? d : a), series[0]);
  return (
    <Card aria-labelledby={`${id}-h`}>
      <CardHeader titleId={`${id}-h`} title="Decisions per day" description={<OutcomeLegend />} actions={<ViewToggle value={view} onChange={setView} />} />
      <CardBody>
      <p className="sr-only">
        {formatInt(total)} decisions in total. Busiest day {busiest ? fmtDay(busiest.day) : "none"}.
      </p>
      {view === "chart" ? (
        <div className="h-64 w-full">
          <DecisionBarsPlot series={series} />
        </div>
      ) : (
        <DayTable caption="Decisions per day" headers={OUTCOMES.map((o) => o.label)} rows={series.map((d) => ({ day: d.day, cells: OUTCOMES.map((o) => formatInt(d[o.id])) }))} />
      )}
      </CardBody>
    </Card>
  );
}

/* ---------------- breakdowns ---------------- */

/** Ranked rows: bar length is volume, segments are outcome share. Segments are focusable with a text tooltip. */
export function Breakdown({ title, rows, labelFor }: { title: string; rows: BreakdownRow[]; labelFor?: Record<string, string> }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-ink-3">Opt-in · decisions</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-ink-3">No decisions in this range yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const label = labelFor?.[r.key] ?? r.key;
            return (
              <li key={r.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate capitalize text-ink-2">{label}</span>
                  <span className="shrink-0 tabular-nums text-ink-2">
                    <span className="font-semibold text-ink">{formatPct(r.total ? r.accepted / r.total : 0)}</span>
                    <span className="inline-block w-16 text-right text-ink-3">{formatInt(r.total)}</span>
                  </span>
                </div>
                <div className="flex h-2 gap-[2px]" style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }}>
                  {OUTCOMES.map((o, i) => {
                    const v = r[o.id];
                    if (!v) return null;
                    const key = `${r.key}:${o.id}`;
                    const isFirst = OUTCOMES.slice(0, i).every((n) => !r[n.id]);
                    const isLast = OUTCOMES.slice(i + 1).every((n) => !r[n.id]);
                    return (
                      <span
                        key={o.id}
                        tabIndex={0}
                        role="img"
                        onMouseEnter={() => setHover(key)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(key)}
                        onBlur={() => setHover(null)}
                        aria-label={`${label}: ${formatInt(v)} ${o.label.toLowerCase()}, ${formatPct(v / r.total)}`}
                        className={`relative h-full outline-none transition-[filter] duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${isFirst ? "rounded-l-full" : ""} ${isLast ? "rounded-r-full" : ""}`}
                        style={{ width: `${(v / r.total) * 100}%`, background: o.color }}
                      >
                        {hover === key ? (
                          <span role="tooltip" className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-lift">
                            <span className="font-semibold tabular-nums text-ink">{formatInt(v)}</span> {o.label.toLowerCase()} ({formatPct(v / r.total)})
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Breakdowns({ groups }: { groups: { title: string; rows: BreakdownRow[]; labelFor?: Record<string, string> }[] }) {
  return (
    <Card aria-labelledby="breakdowns-h">
      <CardHeader titleId="breakdowns-h" title="Where decisions come from" actions={<OutcomeLegend />} />
      <CardBody>
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {groups.map((g) => (
            <Breakdown key={g.title} {...g} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------- consent by category ---------------- */

/** Granted rate per optional category, as labelled bars or a table. The numbers are text; the bar only reinforces them. */
export function CategoryConsent({ granted, decisions, previous, range }: { granted: Summary["granted"]; decisions: number; previous: Summary["granted"] | null; range: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  const rows = CATEGORY_RATES.map((c) => ({ ...c, count: granted[c.id], rate: decisions ? granted[c.id] / decisions : 0, prev: previous?.[c.id] ?? null }));
  return (
    <Card aria-labelledby={`${id}-h`} className="h-full">
      <CardHeader
        titleId={`${id}-h`}
        title="Consent by category"
        description={`Share of ${formatInt(decisions)} decisions in ${range} days that allowed each.`}
        actions={<ViewToggle value={view} onChange={setView} />}
      />
      <CardBody>
      {decisions === 0 ? (
        <p className="py-6 text-sm text-ink-3">No decisions in this range yet.</p>
      ) : view === "chart" ? (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{r.label}</span> <span className="text-ink-3 max-sm:block max-sm:text-xs">{r.describe}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-2">
                  <span className="font-semibold text-ink">{formatPct(r.rate)}</span>
                  <span className="inline-block w-16 text-right text-ink-3">{formatInt(r.count)}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-line" aria-hidden>
                <div className="h-full rounded-full bg-success transition-[width] duration-300 ease-out" style={{ width: `${r.rate * 100}%` }} />
              </div>
              {r.prev !== null ? (
                <p className="mt-1">
                  <DeltaText d={{ change: r.rate - r.prev, goodWhen: "neutral", period: `vs previous ${range} days`, format: formatPts }} />
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="scroll-thin overflow-auto rounded-md border border-line" tabIndex={0} role="region" aria-label="Consent by category table">
          <table className="w-full text-sm">
            <caption className="sr-only">Decisions that allowed each optional category, last {range} days</caption>
            <thead className="bg-raised text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Category
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Allowed
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Granted rate
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Previous {range} days
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {r.label}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatInt(r.count)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatPct(r.rate)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.prev === null ? "No data" : formatPct(r.prev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </CardBody>
    </Card>
  );
}
