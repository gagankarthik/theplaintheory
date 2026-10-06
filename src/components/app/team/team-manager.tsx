"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { changeRole, inviteMember, removeMember, revokeInvite } from "@/app/app/team/actions";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { SelectField, TextField } from "@/components/app/ui/field";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Role } from "@/lib/types";

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: Role;
  since: string;
  mfa: boolean;
  lastActiveAt?: string;
  invitedBy?: string;
}
export interface InviteRow {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

type Op = { type: "role"; userId: string; role: Role } | { type: "remove"; userId: string };

export function TeamManager({
  members,
  invites,
  me,
  myRole,
  canManage,
  seatsLeft,
}: {
  members: MemberRow[];
  invites: InviteRow[];
  me: string;
  myRole: Role;
  canManage: boolean;
  seatsLeft: number | null;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [rows, apply] = useOptimistic(members, (list: MemberRow[], op: Op) =>
    op.type === "remove" ? list.filter((m) => m.userId !== op.userId) : list.map((m) => (m.userId === op.userId ? { ...m, role: op.role } : m)),
  );
  const run = (op: Op, fn: () => Promise<ActionResult>) =>
    start(async () => {
      apply(op);
      const r = await fn();
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) toast(r.ok);
    });

  // Admins can't promote to or demote from owner.
  const editable = (m: MemberRow) => canManage && m.userId !== me && (myRole === "owner" || m.role !== "owner");

  const columns: Column<MemberRow>[] = [
    {
      id: "name",
      header: "Member",
      sortValue: (m) => m.name.toLowerCase(),
      cell: (m) => (
        <>
          <span className="font-bold">
            {m.name}
            {m.userId === me ? <span className="font-normal text-ink-3"> (you)</span> : null}
          </span>
          <span className="block text-xs text-ink-3">{m.email}</span>
        </>
      ),
    },
    {
      id: "role",
      header: "Role",
      sortValue: (m) => m.role,
      cell: (m) =>
        editable(m) ? (
          <label>
            <span className="sr-only">Role for {m.name}</span>
            <select
              className="field h-9 w-auto py-0 pr-8 text-sm max-sm:h-11"
              value={m.role}
              onChange={(e) => {
                const role = e.target.value as Role;
                run({ type: "role", userId: m.userId, role }, () => changeRole(m.userId, role));
              }}
            >
              {ROLES.filter((r) => myRole === "owner" || r.value !== "owner").map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLES.find((r) => r.value === m.role)?.label}</Badge>
        ),
    },
    {
      id: "mfa",
      header: "Two-factor",
      sortValue: (m) => (m.mfa ? 1 : 0),
      cell: (m) => (m.mfa ? <Badge tone="released">On</Badge> : <Badge tone="held">Off</Badge>),
    },
    {
      id: "active",
      header: "Last active",
      sortValue: (m) => m.lastActiveAt ?? "",
      cell: (m) => <span className="text-ink-2">{m.lastActiveAt ? date(m.lastActiveAt) : "Never"}</span>,
    },
    {
      id: "since",
      header: "Joined",
      sortValue: (m) => m.since,
      cell: (m) => (
        <>
          <span className="text-ink-2">{date(m.since)}</span>
          {m.invitedBy ? <span className="block text-xs text-ink-3">by {m.invitedBy}</span> : null}
        </>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            mobileLabel: "Actions",
            align: "right" as const,
            cell: (m: MemberRow) =>
              editable(m) ? (
                <Button variant="quiet" size="sm" onClick={() => run({ type: "remove", userId: m.userId }, () => removeMember(m.userId))}>
                  Remove<span className="sr-only"> {m.name}</span>
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-10">
      <DataTable caption="Members" rows={rows} columns={columns} rowKey={(m) => m.userId} initialSort={{ id: "name", dir: "ascending" }} minWidth={760} />

      {invites.length ? (
        <section aria-labelledby="invites-h">
          <h2 id="invites-h" className="mb-3 text-lg font-bold">
            Pending invites
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{i.email}</span>
                  <span className="text-xs text-ink-3">
                    Joins as {i.role} when they sign up. Invited {date(i.createdAt)}.
                  </span>
                </span>
                {canManage ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() =>
                      start(async () => {
                        const r = await revokeInvite(i.id);
                        if (r?.error) toast(r.error, "error");
                        else if (r?.ok) toast(r.ok);
                      })
                    }
                  >
                    Revoke<span className="sr-only"> invite for {i.email}</span>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? <InviteForm seatsLeft={seatsLeft} /> : null}
    </div>
  );
}

function InviteForm({ seatsLeft }: { seatsLeft: number | null }) {
  const [state, action] = useActionState<ActionResult, FormData>(inviteMember, null);
  return (
    <section aria-labelledby="invite-h" className="border-t border-line pt-8">
      <h2 id="invite-h" className="text-lg font-bold">
        Invite someone
      </h2>
      <p className="mb-5 text-sm text-ink-3">
        {seatsLeft === null ? "Your plan has unlimited seats." : seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left on your plan.` : "All seats are in use. Upgrade in Billing to invite more people."}
      </p>
      <form action={action} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-start" noValidate>
        <TextField id="invite-email" name="email" type="email" required maxLength={254} label="Email" placeholder="colleague@company.com" autoComplete="off" error={state?.fieldErrors?.email} />
        <SelectField
          id="invite-role"
          name="role"
          label="Role"
          defaultValue="viewer"
          options={[
            { value: "viewer", label: "Viewer" },
            { value: "admin", label: "Admin" },
          ]}
          error={state?.fieldErrors?.role}
        />
        <div className="md:pt-[26px]">
          <SubmitButton pending="Inviting" className="w-full md:w-auto" disabled={seatsLeft === 0}>
            Send invite
          </SubmitButton>
        </div>
      </form>
      <div className="mt-4">
        <FormMessage state={state && !state.fieldErrors ? state : null} />
      </div>
    </section>
  );
}
