"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDay } from "./format";
import { SERIES, type Day } from "./overview-series";

/** The Recharts part of SignupsChart, split out so the library loads lazily. */
const AXIS = { fill: "var(--color-ink-3)", fontSize: 12 };

export function SignupsPlot({ data }: { data: Day[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
        barGap={1}
      >
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDay}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--color-line-strong)" }}
          minTickGap={32}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: "var(--color-raised)" }}
          content={(p) => {
            if (!p.active || !p.payload?.length) return null;
            const d = p.payload[0].payload as Day;
            return (
              <div className="rounded-md border border-line-strong bg-surface px-3 py-2 text-xs shadow-[var(--shadow-float)]">
                <p className="text-ink-3">{fmtDay(d.day)}</p>
                <p className="mt-0.5 font-semibold tabular-nums text-ink">
                  {d.users} new users
                </p>
                <p className="font-semibold tabular-nums text-ink-2">
                  {d.orgs} new organizations
                </p>
              </div>
            );
          }}
        />
        {SERIES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[2, 2, 0, 0]}
            maxBarSize={10}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
