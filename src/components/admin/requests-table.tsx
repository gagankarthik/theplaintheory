"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { leadReference } from "@/lib/lead-options";
import type { Lead } from "@/lib/types";
import { fmtDateTime } from "./format";
import { LeadStatusBadge, LeadTopicBadge, SeverityBadge, leadSummary } from "./requests-list";

const PAGE_SIZE = 50;

/** The inbox, newest first; filtering happens on the server from the URL. */
export function RequestsTable({ leads }: { leads: Lead[] }) {
  const columns: Column<Lead>[] = [
    {
      id: "request",
      header: "Request",
      sortValue: (l) => leadSummary(l).toLowerCase(),
      cell: (l) => (
        <span className="block min-w-0 max-w-[40ch]">
          <Link href={`/admin/requests/${l.id}`} className="block truncate font-semibold text-ink underline-offset-4 hover:underline">
            {leadSummary(l)}
          </Link>
          <span className="block font-mono text-xs text-ink-3">{leadReference(l.id)}</span>
        </span>
      ),
    },
    {
      id: "from",
      header: "From",
      sortValue: (l) => l.name.toLowerCase(),
      cell: (l) => (
        <span className="block min-w-0 max-w-[28ch]">
          <span className="block truncate text-ink-2">{l.name}</span>
          <span className="block truncate text-xs text-ink-3">{l.company ?? l.email}</span>
        </span>
      ),
    },
    {
      id: "topic",
      header: "Topic",
      sortValue: (l) => l.topic ?? "sales",
      cell: (l) => (
        <span className="inline-flex flex-wrap justify-end gap-1.5 sm:justify-start">
          <LeadTopicBadge topic={l.topic} />
          <SeverityBadge severity={l.severity} />
        </span>
      ),
    },
    { id: "status", header: "Status", sortValue: (l) => ["new", "open", "closed"].indexOf(l.status ?? "new"), cell: (l) => <LeadStatusBadge status={l.status} /> },
    { id: "received", header: "Received", numeric: true, sortValue: (l) => l.createdAt, cell: (l) => <time dateTime={l.createdAt} className="whitespace-nowrap text-ink-2">{fmtDateTime(l.createdAt)}</time> },
  ];

  return (
    <DataTable
      caption="Contact requests"
      rows={leads}
      columns={columns}
      rowKey={(l) => l.id}
      initialSort={{ id: "received", dir: "descending" }}
      minWidth={820}
      maxHeight="72dvh"
      pageSize={PAGE_SIZE}
      noun={["request", "requests"]}
      empty="No requests match these filters."
    />
  );
}
