"use client";

import { useActionState, useId, useOptimistic, useState, useTransition } from "react";
import { changeRole, inviteMember, removeMember, revokeInvite } from "@/app/app/team/actions";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { CopyButton } from "@/components/app/ui/copy-button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { Dialog } from "@/components/app/ui/dialog";
import { EmptyState } from "@/components/app/ui/empty-state";
import { SelectField, TextField } from "@/components/app/ui/field";
import { Select, type SelectOption } from "@/components/app/ui/select";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { TabPanel, Tabs } from "@/components/app/ui/tabs";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { IconAlert, IconCheck, IconPlus, IconTeam } from "@/components/icons";
import type { ActionResult } from "@/lib/action-result";
import { INVITE_ROLES, ROLES, ROLE_INFO, ROLE_LABEL, memberChangeProblem } from "@/lib/auth/rbac";
import type { Role } from "@/lib/types";

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: Role;
  since: string;
  mfa: boolean;
  /** required by the org but not set up yet: the end of the member's grace period */
  mfaDue?: string;
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
const fullDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d === 1 ? "" : "s"} ago` : date(iso);
}

const roleOptions = (roles: readonly Role[]): SelectOption<Role>[] => roles.map((r) => ({ value: r, label: ROLE_LABEL[r], description: ROLE_INFO[r] }));

/** Initials on a quiet chip (lime is kept for "on" states); the name always sits next to it in text. */
function Initials({ name }: { name: string }) {
  const text =
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold text-ink-2 ring-1 ring-inset ring-line">
      {text}
    </span>
  );
}

type Op = { type: "role"; userId: string; role: Role };
type Tab = "members" | "invites";

export function TeamManager({
  members,
  invites,
  me,
  myRole,
  canManage,
  seatsLeft,
  now,
  inviteAction,
}: {
  members: MemberRow[];
  invites: InviteRow[];
  me: string;
  myRole: Role;
  canManage: boolean;
  seatsLeft: number | null;
  /** server render time, so "x days ago" is stable between server and client */
  now: number;
  /** the header's invite action (locked when out of seats), repeated in the empty state */
  inviteAction?: React.ReactNode;
}) {
  const toast = useToast();
  const idBase = useId();
  const [tab, setTab] = useState<Tab>("members");
  const [, start] = useTransition();
  const [rows, apply] = useOptimistic(members, (list: MemberRow[], op: Op) => list.map((m) => (m.userId === op.userId ? { ...m, role: op.role } : m)));
  // destructive row actions go through a confirmation first
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [revoking, setRevoking] = useState<InviteRow | null>(null);
  const settle = (r: ActionResult) => {
    if (r?.error) return { error: r.error };
    if (r?.ok) toast(r.ok);
  };
  const run = (op: Op, fn: () => Promise<ActionResult>) =>
    start(async () => {
      apply(op);
      const r = await fn();
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) toast(r.ok);
    });

  // Mirrors the server check: admins can't remove, promote to or demote from owner.
  const editable = (m: MemberRow) => canManage && memberChangeProblem({ actorRole: myRole, actorUserId: me, targetUserId: m.userId, targetRole: m.role, next: null }) === null;
  const assignable = roleOptions(ROLES.filter((r) => myRole === "owner" || r !== "owner"));

  const memberColumns: Column<MemberRow>[] = [
    {
      id: "name",
      header: "Member",
      sortValue: (m) => m.name.toLowerCase(),
      cell: (m) => (
        <span className="flex items-center gap-3">
          <Initials name={m.name} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">
              {m.name}
              {m.userId === me ? <span className="font-normal text-ink-3"> (you)</span> : null}
            </span>
            <span className="block truncate text-xs text-ink-3">{m.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      sortValue: (m) => ROLES.indexOf(m.role),
      cell: (m) =>
        editable(m) ? (
          <div className="w-36">
            <Select<Role>
              size="sm"
              aria-label={`Role for ${m.name}`}
              value={m.role}
              options={assignable}
              menuWidth={300}
              onValueChange={(role) => run({ type: "role", userId: m.userId, role }, () => changeRole(m.userId, role))}
            />
          </div>
        ) : (
          <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
        ),
    },
    {
      id: "mfa",
      header: "Two-factor",
      sortValue: (m) => (m.mfa ? 1 : 0),
      // a system setting, not a consent state: text first, with a quiet icon
      cell: (m) =>
        m.mfa ? (
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <IconCheck size={14} aria-hidden className="text-success" /> On
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-warning">
            <IconAlert size={14} aria-hidden />
            {m.mfaDue ? `Not set up · due ${date(m.mfaDue)}` : "Off"}
          </span>
        ),
    },
    {
      id: "active",
      header: "Last active",
      sortValue: (m) => m.lastActiveAt ?? "",
      cell: (m) =>
        m.lastActiveAt ? (
          <span className="text-ink-2" title={fullDate(m.lastActiveAt)}>
            {ago(m.lastActiveAt, now)}
          </span>
        ) : (
          <span className="text-ink-3">Never</span>
        ),
    },
    {
      id: "since",
      header: "Joined",
      sortValue: (m) => m.since,
      hideOnMobile: true,
      cell: (m) => (
        <span className="text-ink-2" title={m.invitedBy ? `Invited by ${m.invitedBy}` : undefined}>
          {date(m.since)}
        </span>
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
                <Button variant="danger-quiet" size="sm" onClick={() => setRemoving(m)}>
                  Remove<span className="sr-only"> {m.name}</span>
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const inviteColumns: Column<InviteRow>[] = [
    {
      id: "email",
      header: "Invited person",
      sortValue: (i) => i.email,
      cell: (i) => (
        <span className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-boundary text-ink-3">
            <IconTeam size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{i.email}</span>
            <span className="block text-xs text-ink-3">Joins when they sign up with this email</span>
          </span>
        </span>
      ),
    },
    { id: "role", header: "Role", sortValue: (i) => ROLES.indexOf(i.role), cell: (i) => <Badge tone="neutral">{ROLE_LABEL[i.role]}</Badge> },
    {
      id: "sent",
      header: "Invited",
      sortValue: (i) => i.createdAt,
      cell: (i) => (
        <span className="text-ink-2" title={fullDate(i.createdAt)}>
          {ago(i.createdAt, now)}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            mobileLabel: "Actions",
            align: "right" as const,
            cell: (i: InviteRow) => (
              <span className="inline-flex items-center gap-1">
                {site ? <CopyButton value={`${site}/signup?email=${encodeURIComponent(i.email)}`} label="Copy invite link" /> : null}
                <Button variant="danger-quiet" size="sm" onClick={() => setRevoking(i)}>
                  Revoke<span className="sr-only"> invite for {i.email}</span>
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  const count = (n: number) => <span className={`ml-1.5 rounded-full px-1.5 py-px text-xs font-medium tabular-nums ${n ? "bg-raised text-ink-2 ring-1 ring-inset ring-line" : "text-ink-3"}`}>{n}</span>;

  return (
    <div>
      <div className="mb-4">
        <Tabs<Tab>
          idBase={idBase}
          label="Team"
          value={tab}
          onChange={setTab}
          items={[
            { value: "members", label: <>Members{count(rows.length)}</> },
            { value: "invites", label: <>Pending invitations{count(invites.length)}</> },
          ]}
        />
      </div>

      {tab === "members" ? (
        <TabPanel idBase={idBase} value="members">
          <DataTable caption="Members" rows={rows} columns={memberColumns} rowKey={(m) => m.userId} initialSort={{ id: "role", dir: "ascending" }} minWidth={760} />
          {canManage ? null : <p className="mt-3 text-xs text-ink-3">Only owners and admins can change roles or remove people.</p>}
        </TabPanel>
      ) : (
        <TabPanel idBase={idBase} value="invites">
          {invites.length ? (
            <DataTable caption="Pending invitations" rows={invites} columns={inviteColumns} rowKey={(i) => i.id} initialSort={{ id: "sent", dir: "descending" }} minWidth={680} />
          ) : (
            <EmptyState icon={<IconTeam size={24} />} title="No pending invitations" action={inviteAction ?? (canManage ? <InviteButton seatsLeft={seatsLeft} /> : undefined)}>
              People you invite show up here until they create their account.
            </EmptyState>
          )}
        </TabPanel>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.name}?` : "Remove member"}
        description={removing ? `${removing.email || "They"} will lose access to every site in this organization straight away. You can invite them again later.` : undefined}
        confirmLabel="Remove member"
        pendingLabel="Removing"
        destructive
        onConfirm={async () => (removing ? settle(await removeMember(removing.userId)) : undefined)}
      />
      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        title="Revoke this invitation?"
        description={revoking ? `${revoking.email} won't be able to join with this invite. You can send a new one later.` : undefined}
        confirmLabel="Revoke invitation"
        pendingLabel="Revoking"
        destructive
        onConfirm={async () => (revoking ? settle(await revokeInvite(revoking.id)) : undefined)}
      />
    </div>
  );
}

/** Primary "Invite" action; the form lives in a dialog so the page stays about the people. */
export function InviteButton({ seatsLeft }: { seatsLeft: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconPlus size={18} aria-hidden />
        Invite
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a teammate"
        description={seatsLeft === null ? "Your plan has unlimited seats." : seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left on your plan.` : undefined}
        width={480}
      >
        <InviteForm seatsLeft={seatsLeft} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function InviteForm({ seatsLeft, onDone }: { seatsLeft: number | null; onDone: () => void }) {
  const toast = useToast();
  // success is a toast and the dialog closes; errors stay inline next to the field
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await inviteMember(prev, form);
    if (r?.ok && !r.error) {
      toast(r.ok);
      onDone();
      return null;
    }
    return r;
  }, null);
  if (seatsLeft === 0)
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-2">Every seat on your plan is in use. Upgrade to invite more people, or remove someone first.</p>
        <ButtonLink href="/app/billing#plans" className="w-full">
          See plans
        </ButtonLink>
      </div>
    );
  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField id="invite-email" name="email" type="email" required maxLength={254} label="Email" placeholder="colleague@company.com" autoComplete="off" autoFocus error={state?.fieldErrors?.email} />
      <SelectField<Role> id="invite-role" name="role" label="Role" defaultValue="viewer" options={roleOptions([...INVITE_ROLES].reverse())} menuWidth={320} error={state?.fieldErrors?.role} />
      {state?.error && !state.fieldErrors ? <FormMessage state={state} /> : null}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pending="Sending">Send invite</SubmitButton>
      </div>
    </form>
  );
}
