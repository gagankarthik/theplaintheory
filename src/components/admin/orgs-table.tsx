"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { PLANS } from "@/lib/plans";
import type { OrgSummary } from "@/lib/platform/data";
import { OrgStatusBadge, PlanBadge } from "./badges";
import { ListFilters } from "./filter-bar";
import { REGION_LABEL, fmtDate, fmtInt } from "./format";

const ALL = "all";
const PAGE_SIZE = 50;

export function OrgsTable({ orgs }: { orgs: OrgSummary[] }) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orgs.filter(
      (o) =>
        (!needle || o.name.toLowerCase().includes(needle) || o.id.toLowerCase().includes(needle) || o.owners.some((e) => e.toLowerCase().includes(needle))) &&
        (plan === ALL || o.plan === plan) &&
        (kind === ALL || o.kind === kind) &&
        (status === ALL || (status === "suspended") === o.suspended),
    );
  }, [orgs, q, plan, kind, status]);

  const columns: Column<OrgSummary>[] = [
    {
      id: "name",
      header: "Organization",
      sortValue: (o) => o.name.toLowerCase(),
      cell: (o) => (
        <span className="block min-w-0 max-w-[36ch]">
          <Link href={`/admin/orgs/${o.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
            {o.name}
          </Link>
          <span className="block truncate text-xs text-ink-3">{o.owners.length ? `Owner: ${o.owners.join(", ")}` : "No owner"}</span>
        </span>
      ),
    },
    { id: "plan", header: "Plan", sortValue: (o) => PLANS.findIndex((p) => p.id === o.plan), cell: (o) => <PlanBadge plan={o.plan} /> },
    { id: "kind", header: "Type", sortValue: (o) => o.kind, cell: (o) => <span className="text-ink-2">{o.kind === "personal" ? "Personal" : "Company"}</span> },
    { id: "members", header: "Members", numeric: true, sortValue: (o) => o.members, cell: (o) => fmtInt(o.members) },
    { id: "sites", header: "Sites", numeric: true, sortValue: (o) => o.sites, cell: (o) => fmtInt(o.sites) },
    { id: "region", header: "Region", sortValue: (o) => o.region, hideOnMobile: true, cell: (o) => <span className="whitespace-nowrap text-ink-2">{REGION_LABEL[o.region] ?? o.region}</span> },
    { id: "created", header: "Created", numeric: true, sortValue: (o) => o.createdAt, cell: (o) => <span className="whitespace-nowrap text-ink-2">{fmtDate(o.createdAt)}</span> },
    { id: "status", header: "Status", sortValue: (o) => (o.suspended ? 1 : 0), cell: (o) => <OrgStatusBadge suspended={o.suspended} /> },
  ];

  return (
    <>
      <ListFilters
        idBase="orgs"
        label="Filter organizations"
        query={q}
        onQuery={setQ}
        searchLabel="Search"
        placeholder="Name, id or owner email"
        count={rows.length}
        total={orgs.length}
        noun={["organization", "organizations"]}
        filters={[
          { id: "plan", label: "Plan", value: plan, onChange: setPlan, options: [{ value: ALL, label: "All plans" }, ...PLANS.map((p) => ({ value: p.id, label: p.name }))] },
          {
            id: "kind",
            label: "Type",
            value: kind,
            onChange: setKind,
            options: [
              { value: ALL, label: "All types" },
              { value: "organization", label: "Company or agency" },
              { value: "personal", label: "Personal" },
            ],
          },
          {
            id: "status",
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { value: ALL, label: "Any status" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ],
          },
        ]}
      />
      <DataTable
        caption="Organizations"
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        initialSort={{ id: "created", dir: "descending" }}
        minWidth={920}
        maxHeight="72dvh"
        pageSize={PAGE_SIZE}
        noun={["organization", "organizations"]}
        empty={orgs.length ? "No organizations match these filters." : "No organizations yet."}
      />
    </>
  );
}
