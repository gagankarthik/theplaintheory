"use client";

import { useId, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/app/ui/tabs";
import { fmtDay, fmtInt } from "./format";

const AXIS = { fill: "var(--color-ink-3)", fontSize: 12 };
const SERIES = [
  { key: "users", label: "New users", color: "var(--color-brand)" },
  { key: "orgs", label: "New organizations", color: "var(--color-jade-bright)" },
] as const;

interface Day {
  day: string;
  users: number;
  orgs: number;
}

/** Signups per day with a chart/table toggle and a text summary for screen readers. */
export function SignupsChart({ data }: { data: Day[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  const totals = useMemo(() => ({ users: data.reduce((s, d) => s + d.users, 0), orgs: data.reduce((s, d) => s + d.orgs, 0) }), [data]);
  const busiest = data.reduce<Day | null>((a, d) => (d.users > (a?.users ?? 0) ? d : a), null);
  const rows = data.filter((d) => d.users || d.orgs).reverse();

  return (
    <section aria-labelledby={`${id}-h`} className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={`${id}-h`} className="text-base font-bold">
            Signups by day
          </h2>
          <p className="text-sm text-ink-3">Last {data.length} days, UTC.</p>
        </div>
        <Segmented
          size="sm"
          label="Display signups as"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>
      <p className="mb-3 text-sm text-ink-2">
        {fmtInt(totals.users)} new user{totals.users === 1 ? "" : "s"} and {fmtInt(totals.orgs)} new organization{totals.orgs === 1 ? "" : "s"}
        {busiest ? `; busiest day ${fmtDay(busiest.day)} with ${busiest.users} user${busiest.users === 1 ? "" : "s"}` : ""}.
      </p>
      {view === "chart" ? (
        <>
          <ul className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2" aria-hidden>
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
          <div className="h-60 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={1}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--color-line-strong)" }} minTickGap={32} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                <Tooltip
                  cursor={{ fill: "var(--color-paper)" }}
                  content={(p) => {
                    if (!p.active || !p.payload?.length) return null;
                    const d = p.payload[0].payload as Day;
                    return (
                      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lift">
                        <p className="text-ink-3">{fmtDay(d.day)}</p>
                        <p className="mt-0.5 font-bold tabular-nums text-ink">{d.users} users</p>
                        <p className="font-bold tabular-nums text-ink">{d.orgs} organizations</p>
                      </div>
                    );
                  }}
                />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={10} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="max-h-60 overflow-auto rounded-md border border-line" tabIndex={0} role="region" aria-label="Signups by day table">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Signups per day, days with signups only, newest first</caption>
            <thead className="sticky top-0 bg-paper text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-2 font-bold">
                  Day
                </th>
                <th scope="col" className="px-4 py-2 text-right font-bold">
                  Users
                </th>
                <th scope="col" className="px-4 py-2 text-right font-bold">
                  Organizations
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length ? (
                rows.map((d) => (
                  <tr key={d.day}>
                    <th scope="row" className="px-4 py-2 font-normal">
                      {fmtDay(d.day)}
                    </th>
                    <td className="px-4 py-2 text-right tabular-nums">{d.users}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.orgs}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-3">
                    No signups in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Plan mix as labelled bars: the numbers are text, the bar only reinforces them. */
export function PlanMix({ mix, total }: { mix: { plan: string; name: string; orgs: number }[]; total: number }) {
  const max = Math.max(1, ...mix.map((m) => m.orgs));
  return (
    <section aria-labelledby="planmix-h" className="panel p-5 sm:p-6">
      <h2 id="planmix-h" className="text-base font-bold">
        Plan mix
      </h2>
      <p className="mb-4 text-sm text-ink-3">Organizations on each plan.</p>
      <ul className="space-y-3">
        {mix.map((m) => (
          <li key={m.plan}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span>{m.name}</span>
              <span className="tabular-nums text-ink-2">
                <span className="font-bold text-ink">{m.orgs}</span>
                {total ? ` · ${Math.round((m.orgs / total) * 100)}%` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-brand" style={{ width: `${(m.orgs / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
