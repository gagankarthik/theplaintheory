"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { PLATFORM_AUDIT_LABELS, type PlatformAuditAction, type PlatformAuditEvent } from "@/lib/platform/types";
import { ListFilters } from "./filter-bar";
import { fmtDateTime } from "./format";

const ALL = "all";
const PAGE_SIZE = 50;
const GROUPS = [
  { value: "org", label: "Organizations" },
  { value: "user", label: "Users" },
  { value: "staff", label: "Staff roles" },
  { value: "lead", label: "Contact requests" },
];

const metaText = (m: PlatformAuditEvent["metadata"]) =>
  m
    ? Object.entries(m)
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" · ")
    : "";

const targetHref = (e: PlatformAuditEvent) => (e.target.type === "org" ? `/admin/orgs/${e.target.id}` : e.target.type === "lead" ? `/admin/requests/${e.target.id}` : `/admin/users/${e.target.id}`);

export function AuditTable({ events }: { events: PlatformAuditEvent[] }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState(ALL);
  const [actor, setActor] = useState(ALL);
  const actors = useMemo(() => [...new Set(events.map((e) => e.actorEmail))].sort(), [events]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter(
      (e) =>
        (action === ALL || e.action === action || e.action.startsWith(`${action}.`)) &&
        (actor === ALL || e.actorEmail === actor) &&
        (!needle || (e.target.label ?? "").toLowerCase().includes(needle) || e.target.id.toLowerCase().includes(needle) || metaText(e.metadata).toLowerCase().includes(needle)),
    );
  }, [events, q, action, actor]);

  const columns: Column<PlatformAuditEvent>[] = [
    {
      id: "action",
      header: "Action",
      sortValue: (e) => e.action,
      cell: (e) => (
        <span className="block min-w-0">
          <span className="font-semibold text-ink">{PLATFORM_AUDIT_LABELS[e.action] ?? e.action}</span>
          <span className="block truncate text-xs text-ink-3">
            {e.target.type === "staff" ? (
              (e.target.label ?? e.target.id)
            ) : (
              <Link href={targetHref(e)} className="text-ink-2 underline underline-offset-4 hover:text-ink">
                {e.target.label ?? e.target.id}
              </Link>
            )}
          </span>
        </span>
      ),
    },
    {
      id: "actor",
      header: "By",
      sortValue: (e) => e.actorEmail,
      cell: (e) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink-2">{e.actorEmail}</span>
          <span className="block text-xs capitalize text-ink-3">{e.actorRole}</span>
        </span>
      ),
    },
    { id: "details", header: "Details", cell: (e) => <span className="block max-w-[40ch] font-mono text-xs text-ink-2 [overflow-wrap:anywhere]">{metaText(e.metadata) || <span className="font-sans text-ink-3">None</span>}</span> },
    { id: "when", header: "When", numeric: true, sortValue: (e) => e.seq, cell: (e) => <time dateTime={e.createdAt} className="whitespace-nowrap text-ink-2">{fmtDateTime(e.createdAt)}</time> },
  ];

  return (
    <>
      <ListFilters
        idBase="paudit"
        label="Filter audit events"
        query={q}
        onQuery={setQ}
        searchLabel="Search"
        placeholder="Organization, email or detail"
        count={rows.length}
        total={events.length}
        noun={["event", "events"]}
        filters={[
          {
            id: "action",
            label: "Action",
            value: action,
            onChange: setAction,
            options: [
              { value: ALL, label: "All actions" },
              ...GROUPS.map((g) => ({ value: g.value, label: `${g.label} (all)` })),
              ...(Object.keys(PLATFORM_AUDIT_LABELS) as PlatformAuditAction[]).map((a) => ({ value: a, label: PLATFORM_AUDIT_LABELS[a] })),
            ],
          },
          { id: "actor", label: "Staff member", value: actor, onChange: setActor, options: [{ value: ALL, label: "Anyone" }, ...actors.map((a) => ({ value: a, label: a }))] },
        ]}
      />
      <DataTable
        caption="Platform audit log"
        rows={rows}
        columns={columns}
        rowKey={(e) => e.id}
        initialSort={{ id: "when", dir: "descending" }}
        minWidth={880}
        maxHeight="72dvh"
        pageSize={PAGE_SIZE}
        noun={["event", "events"]}
        empty={events.length ? "No events match these filters." : "No staff actions yet."}
      />
    </>
  );
}
