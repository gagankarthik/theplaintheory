"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/app/ui/badge";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import type { UserSummary } from "@/lib/platform/data";
import { MfaBadge } from "./badges";
import { ListFilters } from "./filter-bar";
import { fmtDate } from "./format";

const ALL = "all";
const PAGE_SIZE = 50;

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
        (flag === ALL || (flag === "locked" && u.locked) || (flag === "no-org" && u.orgs.length === 0)),
    );
  }, [users, q, mfa, flag]);

  const columns: Column<UserSummary>[] = [
    {
      id: "name",
      header: "User",
      sortValue: (u) => u.name.toLowerCase(),
      cell: (u) => (
        <span className="block min-w-0 max-w-[34ch]">
          <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
            {u.name}
          </Link>
          <span className="block truncate text-xs text-ink-3">{u.email}</span>
        </span>
      ),
    },
    {
      id: "orgs",
      header: "Organizations",
      sortValue: (u) => u.orgs.length,
      cell: (u) =>
        u.orgs.length ? (
          <span className="block max-w-[30ch] truncate text-ink-2" title={u.orgs.map((o) => o.name).join(", ")}>
            {u.orgs.map((o) => o.name).join(", ")}
          </span>
        ) : (
          <span className="text-ink-3">None</span>
        ),
    },
    { id: "mfa", header: "Two-factor", sortValue: (u) => (u.mfa ? 1 : 0), cell: (u) => <MfaBadge on={u.mfa} /> },
    {
      id: "locked",
      header: "Sign-in",
      sortValue: (u) => (u.locked ? 1 : 0),
      cell: (u) => (u.locked ? <Badge tone="danger">Locked</Badge> : <span className="text-ink-3">Normal</span>),
    },
    { id: "active", header: "Last active", numeric: true, sortValue: (u) => u.lastActiveAt ?? "", cell: (u) => <span className="whitespace-nowrap text-ink-2">{fmtDate(u.lastActiveAt)}</span> },
    { id: "created", header: "Joined", numeric: true, sortValue: (u) => u.createdAt, hideOnMobile: true, cell: (u) => <span className="whitespace-nowrap text-ink-2">{fmtDate(u.createdAt)}</span> },
  ];

  return (
    <>
      <ListFilters
        idBase="users"
        label="Filter users"
        query={q}
        onQuery={setQ}
        searchLabel="Search"
        placeholder="Name, email or organization"
        count={rows.length}
        total={users.length}
        noun={["user", "users"]}
        filters={[
          {
            id: "mfa",
            label: "Two-factor",
            value: mfa,
            onChange: setMfa,
            options: [
              { value: ALL, label: "On or off" },
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ],
          },
          {
            id: "flag",
            label: "Show",
            value: flag,
            onChange: setFlag,
            options: [
              { value: ALL, label: "Everyone" },
              { value: "locked", label: "Locked out" },
              { value: "no-org", label: "No organization" },
            ],
          },
        ]}
      />
      <DataTable
        caption="Users"
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        initialSort={{ id: "created", dir: "descending" }}
        minWidth={920}
        maxHeight="72dvh"
        pageSize={PAGE_SIZE}
        noun={["user", "users"]}
        empty={users.length ? "No users match these filters." : "No users yet."}
      />
    </>
  );
}
