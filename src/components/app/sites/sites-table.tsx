"use client";

import Link from "next/link";
import { formatInt, formatPct } from "@/lib/analytics";
import { PublishBadge } from "@/components/app/ui/badge";
import { DataTable, type Column } from "@/components/app/ui/data-table";

export interface SiteRow {
  id: string;
  name: string;
  domain: string;
  dirty: boolean;
  published: boolean;
  trackers: number;
  decisions: number;
  optIn: number | null;
}

const columns: Column<SiteRow>[] = [
  {
    id: "name",
    header: "Site",
    sortValue: (r) => r.name.toLowerCase(),
    cell: (r) => (
      <>
        {/* the whole row is clickable through the stretched link; it stays a single tab stop */}
        <Link href={`/app/sites/${r.id}`} className="font-bold text-ink after:absolute after:inset-0 hover:text-brand">
          {r.name}
        </Link>
        <span className="block text-xs text-ink-3">{r.domain}</span>
      </>
    ),
  },
  { id: "status", header: "Status", cell: (r) => <PublishBadge dirty={r.dirty} published={r.published} /> },
  { id: "trackers", header: "Trackers", align: "right", sortValue: (r) => r.trackers, cell: (r) => r.trackers },
  { id: "decisions", header: "Decisions, 30 days", mobileLabel: "Decisions, 30 days", align: "right", sortValue: (r) => r.decisions, cell: (r) => formatInt(r.decisions) },
  {
    id: "optin",
    header: "Opt-in rate",
    align: "right",
    sortValue: (r) => r.optIn ?? -1,
    cell: (r) => (r.optIn === null ? <span className="text-ink-3">No data</span> : <span className="font-bold">{formatPct(r.optIn)}</span>),
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
    />
  );
}
