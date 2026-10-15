"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OUTCOMES, formatInt, formatPct, type DayPoint } from "@/lib/analytics";

/** The Recharts parts of charts.tsx, split out so the library loads lazily (next/dynamic, client only). */

const fmtDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const AXIS = { fill: "var(--color-ink-3)", fontSize: 12 };
const GRID = "var(--color-line)";

interface TipEntry {
  value?: unknown;
  dataKey?: unknown;
}
/** Narrow Recharts' tooltip props to what our tooltips read. */
const tip = (p: {
  active?: boolean;
  payload?: ReadonlyArray<TipEntry>;
  label?: unknown;
}) => ({ active: p.active, payload: p.payload, label: p.label });

export function MetricLinePlot({
  points,
  color,
  label,
  last,
}: {
  points: { day: string; value: number | null }[];
  color: string;
  label: string;
  last: { day: string; value: number } | null;
}) {
  const m = { color, label };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={points}
        margin={{ top: 8, right: 56, bottom: 0, left: -8 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDay}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--color-line-strong)" }}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
          width={48}
        />
        <Tooltip
          cursor={{
            stroke: "var(--color-ink)",
            strokeOpacity: 0.25,
            strokeWidth: 1,
          }}
          content={(p) => {
            const { active, payload, label } = tip(p);
            if (!active || !payload?.length) return null;
            const v = payload[0].value as number | null;
            return (
              <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lift">
                <p className="text-ink-3">{fmtDay(String(label))}</p>
                <p className="mt-0.5 flex items-center gap-2">
                  <span
                    className="h-[2px] w-3 rounded"
                    style={{ background: m.color }}
                    aria-hidden
                  />
                  <span className="font-semibold tabular-nums text-ink">
                    {v === null ? "No data" : formatPct(v)}
                  </span>
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
          activeDot={{
            r: 5,
            stroke: "var(--color-surface)",
            strokeWidth: 2,
            fill: m.color,
          }}
          connectNulls
          isAnimationActive={false}
          label={(props: {
            x?: number | string;
            y?: number | string;
            index?: number;
          }) =>
            last &&
            props.index === points.findIndex((p) => p.day === last.day) ? (
              <text
                key="end"
                x={Number(props.x) + 8}
                y={Number(props.y) + 4}
                fontSize={12}
                fontWeight={600}
                fill="var(--color-ink)"
              >
                {formatPct(last.value)}
              </text>
            ) : (
              <g key={props.index} />
            )
          }
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DecisionBarsPlot({ series }: { series: DayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={series}
        margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
        barCategoryGap={series.length > 31 ? 1 : "22%"}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDay}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--color-line-strong)" }}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v) => formatInt(Number(v))}
        />
        <Tooltip
          cursor={{ fill: "var(--color-ink)", fillOpacity: 0.04 }}
          content={(p) => {
            const { active, payload, label } = tip(p);
            if (!active || !payload?.length) return null;
            const sum = payload.reduce((s, x) => s + Number(x.value ?? 0), 0);
            return (
              <div className="min-w-44 rounded-md border border-line bg-surface px-3 py-2.5 text-xs shadow-lift">
                <p className="mb-1.5 text-ink-3">{fmtDay(String(label))}</p>
                {[...payload].reverse().map((x) => {
                  const o = OUTCOMES.find((oo) => oo.id === x.dataKey)!;
                  return (
                    <p key={o.id} className="flex items-center gap-2 py-0.5">
                      <span
                        className="h-[2px] w-3 rounded"
                        style={{ background: o.color }}
                        aria-hidden
                      />
                      <span className="font-semibold tabular-nums text-ink">
                        {formatInt(Number(x.value))}
                      </span>
                      <span className="text-ink-3">{o.label}</span>
                    </p>
                  );
                })}
                <p className="mt-1.5 border-t border-line pt-1.5 text-ink-2">
                  <span className="font-semibold tabular-nums text-ink">
                    {formatInt(sum)}
                  </span>{" "}
                  decisions
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
  );
}
