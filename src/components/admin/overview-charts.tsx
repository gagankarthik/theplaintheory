"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { Skeleton } from "@/components/app/ui/skeleton";
import { Segmented } from "@/components/app/ui/tabs";
import { fmtDay, fmtInt } from "./format";
import { SERIES, type Day } from "./overview-series";

// Recharts is loaded on the client only (overview-plot.tsx); the skeleton keeps the chart's size.
const SignupsPlot = dynamic(() => import("./overview-plot").then((m) => m.SignupsPlot), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const DAY_COLUMNS: Column<Day>[] = [
  { id: "day", header: "Day", sortValue: (d) => d.day, cell: (d) => <span className="text-ink">{fmtDay(d.day)}</span> },
  { id: "users", header: "New users", numeric: true, sortValue: (d) => d.users, cell: (d) => fmtInt(d.users) },
  { id: "orgs", header: "New organizations", numeric: true, sortValue: (d) => d.orgs, cell: (d) => fmtInt(d.orgs) },
];

/** Signups per day with a chart/table toggle; the summary sentence states the totals for everyone. */
export function SignupsChart({ data }: { data: Day[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const totals = useMemo(() => ({ users: data.reduce((s, d) => s + d.users, 0), orgs: data.reduce((s, d) => s + d.orgs, 0) }), [data]);
  const busiest = data.reduce<Day | null>((a, d) => (d.users > (a?.users ?? 0) ? d : a), null);
  const rows = useMemo(() => data.filter((d) => d.users || d.orgs), [data]);

  return (
    <Card aria-labelledby="signups-h" className="min-w-0">
      <CardHeader
        titleId="signups-h"
        title="Signups by day"
        description={`Last ${data.length} days, UTC.`}
        actions={
          <Segmented
            size="sm"
            label="Show signups as"
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        }
      />
      <CardBody>
        <p className="mb-4 text-sm text-ink-2">
          <span className="font-semibold tabular-nums text-ink">{fmtInt(totals.users)}</span> new user{totals.users === 1 ? "" : "s"} and{" "}
          <span className="font-semibold tabular-nums text-ink">{fmtInt(totals.orgs)}</span> new organization{totals.orgs === 1 ? "" : "s"}
          {busiest ? `; busiest day ${fmtDay(busiest.day)} with ${busiest.users} user${busiest.users === 1 ? "" : "s"}` : ""}.
        </p>
        {view === "chart" ? (
          <>
            <ul className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2" aria-hidden>
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
            {/* the chart is a picture of the table view, which screen readers get via the toggle */}
            <div className="h-60 w-full" aria-hidden>
              <SignupsPlot data={data} />
            </div>
          </>
        ) : (
          <DataTable
            caption="Signups per day, days with signups only"
            rows={rows}
            columns={DAY_COLUMNS}
            rowKey={(d) => d.day}
            initialSort={{ id: "day", dir: "descending" }}
            minWidth={360}
            maxHeight={240}
            empty="No signups in this period."
          />
        )}
      </CardBody>
    </Card>
  );
}

/** Plan mix as labelled bars: the numbers are text, the bar only reinforces them. */
export function PlanMix({ mix, total }: { mix: { plan: string; name: string; orgs: number }[]; total: number }) {
  const max = Math.max(1, ...mix.map((m) => m.orgs));
  return (
    <Card aria-labelledby="planmix-h" className="min-w-0">
      <CardHeader titleId="planmix-h" title="Plan mix" description="Organizations on each plan." />
      <CardBody>
        <ul className="space-y-4">
          {mix.map((m) => (
            <li key={m.plan}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-2">{m.name}</span>
                <span className="tabular-nums text-ink-3">
                  <span className="font-semibold text-ink">{fmtInt(m.orgs)}</span>
                  {total ? ` · ${Math.round((m.orgs / total) * 100)}%` : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line" aria-hidden>
                <div className="h-full rounded-full bg-ink-2" style={{ width: `${(m.orgs / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
