"use client";

import Link from "next/link";
import { formatInt, formatPct, formatPts } from "@/lib/analytics";
import type { ScanStatus } from "@/lib/trackers";
import { Badge, PublishBadge } from "@/components/app/ui/badge";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { DateText } from "@/components/app/ui/date-text";
import { DeltaText } from "@/components/app/ui/kpi-tile";
import { StatusDot, type DotTone } from "@/components/app/ui/status-dot";

export interface SiteRow {
  id: string;
  name: string;
  domain: string;
  dirty: boolean;
  published: boolean;
  trackers: number;
  decisions: number;
  optIn: number | null;
  /** opt-in rate per 5-day bucket over the last 30 days, oldest first (null: no decisions) */
  trend: (number | null)[];
  /** last 15 days' opt-in rate minus the 15 days before, when both have decisions */
  delta: number | null;
  lastScan: { status: ScanStatus; at: string } | null;
  /** leaks in the last 7 days */
  leaks: number;
}

const SCAN: Record<ScanStatus, { label: string; tone: DotTone }> = {
  queued: { label: "Queued", tone: "warn" },
  running: { label: "Running", tone: "live" },
  ok: { label: "Scanned", tone: "ok" },
  failed: { label: "Scan failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

/** A quiet line of the opt-in rate over 30 days. Decorative: the rate and its change are the text. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const w = 72;
  const h = 24;
  const pts = values.map((v, i) => (v === null ? null : { x: (i / Math.max(1, values.length - 1)) * w, y: h - 2 - v * (h - 4) }));
  const known = pts.filter((p): p is { x: number; y: number } => p !== null);
  if (known.length < 2) return <span className="text-xs text-ink-3">Not enough data</span>;
  const last = known[known.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="inline-block overflow-visible text-ink-2">
      <polyline points={known.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill="currentColor" />
    </svg>
  );
}

const columns: Column<SiteRow>[] = [
  {
    id: "name",
    header: "Site",
    sortValue: (r) => r.name.toLowerCase(),
    cell: (r) => (
      <>
        {/* the whole row is clickable through the stretched link; it stays a single tab stop */}
        <Link href={`/app/sites/${r.id}`} className="font-semibold text-ink underline-offset-4 after:absolute after:inset-0 hover:underline">
          {r.name}
        </Link>
        <span className="block text-xs text-ink-3">{r.domain}</span>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (r) => (r.leaks ? 0 : !r.published ? 1 : r.dirty ? 2 : 3),
    cell: (r) => (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5 sm:justify-start">
        <PublishBadge dirty={r.dirty} published={r.published} />
        {r.leaks ? <Badge tone="danger">{r.leaks === 1 ? "1 leak" : `${formatInt(r.leaks)} leaks`}</Badge> : null}
      </span>
    ),
  },
  {
    id: "optin",
    header: "Opt-in, 30 days",
    mobileLabel: "Opt-in, 30 days",
    align: "right",
    sortValue: (r) => r.optIn ?? -1,
    cell: (r) =>
      r.optIn === null ? (
        <span className="text-ink-3">No decisions yet</span>
      ) : (
        <span className="inline-flex flex-col items-end gap-0.5">
          <span className="font-semibold text-ink">{formatPct(r.optIn)}</span>
          {r.delta !== null ? <DeltaText d={{ change: r.delta, goodWhen: "up", period: "vs prior 15 days", format: formatPts }} /> : null}
        </span>
      ),
  },
  {
    id: "trend",
    header: "Trend",
    hideOnMobile: true,
    cell: (r) => <Sparkline values={r.trend} />,
  },
  { id: "decisions", header: "Decisions", mobileLabel: "Decisions, 30 days", numeric: true, sortValue: (r) => r.decisions, cell: (r) => formatInt(r.decisions) },
  {
    id: "scan",
    header: "Last scan",
    sortValue: (r) => r.lastScan?.at ?? "",
    cell: (r) =>
      r.lastScan ? (
        <span className="inline-flex flex-col gap-0.5 max-sm:items-end">
          <StatusDot tone={SCAN[r.lastScan.status].tone} label={SCAN[r.lastScan.status].label} showLabel />
          <span className="text-xs text-ink-3">
            <DateText iso={r.lastScan.at} mode="relative" /> · {r.trackers === 1 ? "1 tracker" : `${formatInt(r.trackers)} trackers`}
          </span>
        </span>
      ) : (
        <StatusDot tone="idle" label="Not scanned" showLabel />
      ),
  },
];

export function SitesTable({ rows, footer }: { rows: SiteRow[]; footer: string }) {
  return (
    <DataTable
      caption="Sites in this organization"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      initialSort={{ id: "name", dir: "ascending" }}
      rowClassName={() => "relative"}
      footer={footer}
      minWidth={760}
    />
  );
}
