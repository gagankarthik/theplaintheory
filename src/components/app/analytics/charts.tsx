"use client";

import { useId, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
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
import { KpiTile } from "@/components/app/ui/kpi-tile";
import { Segmented } from "@/components/app/ui/tabs";

const fmtDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const AXIS = { fill: "var(--color-ink-3)", fontSize: 12 };
const GRID = "var(--color-line)";

interface TipEntry {
  value?: unknown;
  dataKey?: unknown;
}
/** Narrow Recharts' tooltip props to what our tooltips read. */
const tip = (p: { active?: boolean; payload?: ReadonlyArray<TipEntry>; label?: unknown }) => ({ active: p.active, payload: p.payload, label: p.label });

function ViewToggle({ value, onChange }: { value: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <Segmented
      size="sm"
      label="Display as"
      value={value}
      onChange={onChange}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "View as table" },
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
    <section aria-labelledby={`${chartId}-h`} className="panel overflow-hidden">
      <h2 id={`${chartId}-h`} className="sr-only">
        Key metrics
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

      <div id={chartId} className="p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-bold">{m.label} by day</h3>
            <p className="text-sm text-ink-3">{m.describe}. Pick a figure above to change the chart.</p>
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 56, bottom: 0, left: -8 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--color-line-strong)" }} minTickGap={28} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} width={48} />
                <Tooltip
                  cursor={{ stroke: "var(--color-ink)", strokeOpacity: 0.25, strokeWidth: 1 }}
                  content={(p) => {
                    const { active, payload, label } = tip(p);
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value as number | null;
                    return (
                      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lift">
                        <p className="text-ink-3">{fmtDay(String(label))}</p>
                        <p className="mt-0.5 flex items-center gap-2">
                          <span className="h-[2px] w-3 rounded" style={{ background: m.color }} aria-hidden />
                          <span className="font-bold tabular-nums text-ink">{v === null ? "No data" : formatPct(v)}</span>
                          <span className="text-ink-3">{m.label}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={m.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 5, stroke: "var(--color-surface)", strokeWidth: 2, fill: m.color }}
                  connectNulls
                  isAnimationActive={false}
                  label={(props: { x?: number | string; y?: number | string; index?: number }) =>
                    last && props.index === points.findIndex((p) => p.day === last.day) ? (
                      <text key="end" x={Number(props.x) + 8} y={Number(props.y) + 4} fontSize={12} fontWeight={700} fill="var(--color-ink)">
                        {formatPct(last.value)}
                      </text>
                    ) : (
                      <g key={props.index} />
                    )
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <DayTable
            caption={`${m.label} by day`}
            rows={points.map((p) => ({ day: p.day, cells: [p.value === null ? "No data" : formatPct(p.value)] }))}
            headers={[m.label]}
          />
        )}
      </div>
    </section>
  );
}

/* ---------------- decision volume ---------------- */

function OutcomeLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
      {OUTCOMES.map((o) => (
        <li key={o.id} className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: o.color }} aria-hidden />
          {o.label}
        </li>
      ))}
    </ul>
  );
}

function DayTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: { day: string; cells: string[] }[] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-md border border-line" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-paper text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-bold">
              Day
            </th>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-right font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...rows].reverse().map((r) => (
            <tr key={r.day} className="hover:bg-paper">
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
    <section className="panel p-5 sm:p-6" aria-labelledby={`${id}-h`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={`${id}-h`} className="text-base font-bold">
            Decisions per day
          </h2>
          <div className="mt-2">
            <OutcomeLegend />
          </div>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>
      <p className="sr-only">
        {formatInt(total)} decisions in total. Busiest day {busiest ? fmtDay(busiest.day) : "none"}.
      </p>
      {view === "chart" ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap={series.length > 31 ? 1 : "22%"} accessibilityLayer>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--color-line-strong)" }} minTickGap={28} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => formatInt(Number(v))} />
              <Tooltip
                cursor={{ fill: "var(--color-ink)", fillOpacity: 0.04 }}
                content={(p) => {
                  const { active, payload, label } = tip(p);
                  if (!active || !payload?.length) return null;
                  const sum = payload.reduce((s, x) => s + Number(x.value ?? 0), 0);
                  return (
                    <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-lift">
                      <p className="mb-1.5 text-ink-3">{fmtDay(String(label))}</p>
                      {[...payload].reverse().map((x) => {
                        const o = OUTCOMES.find((oo) => oo.id === x.dataKey)!;
                        return (
                          <p key={o.id} className="flex items-center gap-2 py-0.5">
                            <span className="h-[2px] w-3 rounded" style={{ background: o.color }} aria-hidden />
                            <span className="font-bold tabular-nums text-ink">{formatInt(Number(x.value))}</span>
                            <span className="text-ink-3">{o.label}</span>
                          </p>
                        );
                      })}
                      <p className="mt-1.5 border-t border-line pt-1.5 text-ink-2">
                        <span className="font-bold tabular-nums text-ink">{formatInt(sum)}</span> decisions
                      </p>
                    </div>
                  );
                }}
              />
              {OUTCOMES.map((o, i) => (
                <Bar
                  key={o.id}
                  dataKey={o.id}
                  name={o.label}
                  stackId="d"
                  fill={o.color}
                  maxBarSize={24}
                  stroke="var(--color-surface)"
                  strokeWidth={series.length > 60 ? 0 : 2}
                  radius={i === OUTCOMES.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <DayTable caption="Decisions per day" headers={OUTCOMES.map((o) => o.label)} rows={series.map((d) => ({ day: d.day, cells: OUTCOMES.map((o) => formatInt(d[o.id])) }))} />
      )}
    </section>
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
        <h3 className="text-base font-bold">{title}</h3>
        <span className="text-xs text-ink-3">Opt-in, decisions</span>
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
                  <span className="truncate capitalize text-ink">{label}</span>
                  <span className="shrink-0 tabular-nums text-ink-2">
                    <span className="font-bold text-ink">{formatPct(r.total ? r.accepted / r.total : 0)}</span>
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
                        className={`relative h-full outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 ${isFirst ? "rounded-l-[3px]" : ""} ${isLast ? "rounded-r-[3px]" : ""}`}
                        style={{ width: `${(v / r.total) * 100}%`, background: o.color }}
                      >
                        {hover === key ? (
                          <span role="tooltip" className="absolute bottom-[calc(100%+8px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-lift">
                            <span className="font-bold tabular-nums text-ink">{formatInt(v)}</span> {o.label.toLowerCase()} ({formatPct(v / r.total)})
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
    <section aria-labelledby="breakdowns-h" className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="breakdowns-h" className="text-base font-bold">
          Where decisions come from
        </h2>
        <OutcomeLegend />
      </div>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        {groups.map((g) => (
          <Breakdown key={g.title} {...g} />
        ))}
      </div>
    </section>
  );
}
