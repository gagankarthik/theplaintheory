"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import type { UserSummary } from "@/lib/platform/data";
import { MfaBadge } from "./badges";
import { fmtDate } from "./format";

const COLUMNS: Column<UserSummary>[] = [
  {
    id: "name",
    header: "User",
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
    cell: (u) => (u.orgs.length ? <span className="block max-w-[30ch] truncate text-ink-2">{u.orgs.map((x) => x.name).join(", ")}</span> : <span className="text-ink-3">No organization yet</span>),
  },
  { id: "mfa", header: "Two-factor", cell: (u) => <MfaBadge on={u.mfa} /> },
  { id: "joined", header: "Joined", numeric: true, cell: (u) => <span className="whitespace-nowrap text-ink-2">{fmtDate(u.createdAt)}</span> },
];

/** The newest accounts, newest first (already ordered by the server). */
export function RecentSignupsTable({ users }: { users: UserSummary[] }) {
  return <DataTable caption="Recent signups, newest first" rows={users} columns={COLUMNS} rowKey={(u) => u.id} minWidth={720} empty="No users yet." />;
}
