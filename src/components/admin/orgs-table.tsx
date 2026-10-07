"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { PLANS } from "@/lib/plans";
import type { OrgSummary } from "@/lib/platform/data";
import { OrgStatusBadge, PlanBadge } from "./badges";
import { FilterBar, FilterSelect } from "./filter-bar";
import { REGION_LABEL, fmtDate } from "./format";

const ALL = "all";

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
        <>
          <Link href={`/admin/orgs/${o.id}`} className="font-bold text-ink underline-offset-2 hover:underline">
            {o.name}
          </Link>
          <span className="block truncate text-xs text-ink-3">{o.owners.length ? `Owner: ${o.owners.join(", ")}` : "No owner"}</span>
        </>
      ),
    },
    { id: "plan", header: "Plan", sortValue: (o) => PLANS.findIndex((p) => p.id === o.plan), cell: (o) => <PlanBadge plan={o.plan} /> },
    { id: "kind", header: "Kind", sortValue: (o) => o.kind, cell: (o) => <span className="text-ink-2">{o.kind === "personal" ? "Personal" : "Organization"}</span> },
    { id: "members", header: "Members", align: "right", sortValue: (o) => o.members, cell: (o) => o.members },
    { id: "sites", header: "Sites", align: "right", sortValue: (o) => o.sites, cell: (o) => o.sites },
    { id: "region", header: "Region", sortValue: (o) => o.region, hideOnMobile: true, cell: (o) => <span className="text-ink-2">{REGION_LABEL[o.region] ?? o.region}</span> },
    { id: "created", header: "Created", sortValue: (o) => o.createdAt, cell: (o) => <span className="text-ink-2">{fmtDate(o.createdAt)}</span> },
    { id: "status", header: "Status", sortValue: (o) => (o.suspended ? 1 : 0), cell: (o) => <OrgStatusBadge suspended={o.suspended} /> },
  ];

  return (
    <>
      <FilterBar
        idBase="orgs"
        query={q}
        onQuery={setQ}
        searchLabel="Search organizations"
        placeholder="Name, id or owner email"
        count={rows.length}
        total={orgs.length}
        noun={["organization", "organizations"]}
        onReset={() => {
          setQ("");
          setPlan(ALL);
          setKind(ALL);
          setStatus(ALL);
        }}
      >
        <FilterSelect id="orgs-plan" label="Plan" value={plan} onChange={setPlan} options={[{ value: ALL, label: "All plans" }, ...PLANS.map((p) => ({ value: p.id, label: p.name }))]} />
        <FilterSelect
          id="orgs-kind"
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: ALL, label: "All kinds" },
            { value: "organization", label: "Organization" },
            { value: "personal", label: "Personal" },
          ]}
        />
        <FilterSelect
          id="orgs-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: ALL, label: "Any status" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </FilterBar>
      <DataTable
        caption="Organizations"
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        initialSort={{ id: "created", dir: "descending" }}
        minWidth={900}
        empty={orgs.length ? "No organizations match these filters." : "No organizations yet."}
      />
    </>
  );
}
