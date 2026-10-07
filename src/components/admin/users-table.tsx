"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/app/ui/badge";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import type { UserSummary } from "@/lib/platform/data";
import { MfaBadge, StaffRoleBadge } from "./badges";
import { FilterBar, FilterSelect } from "./filter-bar";
import { fmtDate } from "./format";

const ALL = "all";

export function UsersTable({ users }: { users: UserSummary[] }) {
  const [q, setQ] = useState("");
  const [mfa, setMfa] = useState(ALL);
  const [flag, setFlag] = useState(ALL);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.id.toLowerCase().includes(needle) || u.orgs.some((o) => o.name.toLowerCase().includes(needle))) &&
        (mfa === ALL || (mfa === "on") === u.mfa) &&
        (flag === ALL || (flag === "locked" && u.locked) || (flag === "staff" && u.platformRole !== null) || (flag === "no-org" && u.orgs.length === 0)),
    );
  }, [users, q, mfa, flag]);

  const columns: Column<UserSummary>[] = [
    {
      id: "name",
      header: "User",
      sortValue: (u) => u.name.toLowerCase(),
      cell: (u) => (
        <>
          <Link href={`/admin/users/${u.id}`} className="font-bold text-ink underline-offset-2 hover:underline">
            {u.name}
          </Link>
          <span className="block truncate text-xs text-ink-3">{u.email}</span>
        </>
      ),
    },
    {
      id: "orgs",
      header: "Organizations",
      sortValue: (u) => u.orgs.length,
      cell: (u) => (u.orgs.length ? <span className="text-ink-2">{u.orgs.map((o) => o.name).join(", ")}</span> : <span className="text-ink-3">None</span>),
    },
    { id: "staff", header: "Staff role", sortValue: (u) => u.platformRole ?? "", cell: (u) => <StaffRoleBadge role={u.platformRole} /> },
    { id: "mfa", header: "Two-factor", sortValue: (u) => (u.mfa ? 1 : 0), cell: (u) => <MfaBadge on={u.mfa} /> },
    { id: "active", header: "Last active", sortValue: (u) => u.lastActiveAt ?? "", cell: (u) => <span className="text-ink-2">{fmtDate(u.lastActiveAt)}</span> },
    { id: "locked", header: "Sign-in", sortValue: (u) => (u.locked ? 1 : 0), cell: (u) => (u.locked ? <Badge tone="declined">Locked</Badge> : <span className="text-ink-3">OK</span>) },
    { id: "created", header: "Joined", sortValue: (u) => u.createdAt, hideOnMobile: true, cell: (u) => <span className="text-ink-2">{fmtDate(u.createdAt)}</span> },
  ];

  return (
    <>
      <FilterBar
        idBase="users"
        query={q}
        onQuery={setQ}
        searchLabel="Search users"
        placeholder="Name, email or organization"
        count={rows.length}
        total={users.length}
        noun={["user", "users"]}
        onReset={() => {
          setQ("");
          setMfa(ALL);
          setFlag(ALL);
        }}
      >
        <FilterSelect
          id="users-mfa"
          label="Two-factor"
          value={mfa}
          onChange={setMfa}
          options={[
            { value: ALL, label: "On or off" },
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
        />
        <FilterSelect
          id="users-flag"
          label="Show"
          value={flag}
          onChange={setFlag}
          options={[
            { value: ALL, label: "Everyone" },
            { value: "locked", label: "Locked out" },
            { value: "staff", label: "Staff" },
            { value: "no-org", label: "No organization" },
          ]}
        />
      </FilterBar>
      <DataTable
        caption="Users"
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        initialSort={{ id: "created", dir: "descending" }}
        minWidth={900}
        empty={users.length ? "No users match these filters." : "No users yet."}
      />
    </>
  );
}
