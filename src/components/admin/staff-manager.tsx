"use client";

import { useActionState, useRef, useState } from "react";
import { changeStaffRole, inviteStaffMember, removeStaffMember, resendStaffInvite, resetStaffPassword, setStaffEnabled } from "@/app/admin/actions";
import { Dropdown, MenuSeparator, menuItemClass } from "@/components/app/shell/dropdown";
import { Badge } from "@/components/app/ui/badge";
import { buttonClass } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { SelectField, TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import { PLATFORM_ROLES, PLATFORM_ROLE_INFO, type PlatformRole } from "@/lib/auth/platform";
import { IconChevronDown } from "@/components/icons";
import { ActionConfirm } from "./action-dialog";
import { StaffRoleBadge } from "./badges";
import { fmtDate } from "./format";

export interface StaffRow {
  sub: string;
  name: string;
  email: string;
  role: PlatformRole;
  enabled: boolean;
  /** Cognito UserStatus */
  status: string;
  createdAt?: string;
}

const roleOptions = PLATFORM_ROLES.map((r) => ({ value: r, label: `${PLATFORM_ROLE_INFO[r].label}: ${PLATFORM_ROLE_INFO[r].summary}` }));

function StatusBadge({ s }: { s: StaffRow }) {
  if (!s.enabled) return <Badge tone="danger">Disabled</Badge>;
  if (s.status === "FORCE_CHANGE_PASSWORD") return <Badge tone="warning">Invited</Badge>;
  if (s.status === "CONFIRMED") return <Badge tone="success">Active</Badge>;
  return <Badge tone="neutral">{s.status.toLowerCase().replace(/_/g, " ")}</Badge>;
}

export function StaffManager({ staff, me }: { staff: StaffRow[]; me: string }) {
  const superadmins = staff.filter((s) => s.role === "superadmin" && s.enabled).length;
  /** Same rules the server enforces (staffChangeProblem); the UI explains them up front. */
  const lastSuperadmin = (s: StaffRow) => s.role === "superadmin" && s.enabled && superadmins <= 1;

  const columns: Column<StaffRow>[] = [
    {
      id: "name",
      header: "Staff member",
      sortValue: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <>
          <span className="font-semibold text-ink">
            {s.name}
            {s.sub === me ? <span className="font-normal text-ink-3"> (you)</span> : null}
          </span>
          <span className="block truncate text-xs text-ink-3">{s.email}</span>
        </>
      ),
    },
    { id: "role", header: "Role", sortValue: (s) => PLATFORM_ROLES.indexOf(s.role), cell: (s) => <StaffRoleBadge role={s.role} /> },
    { id: "status", header: "Status", sortValue: (s) => `${s.enabled ? 1 : 0}${s.status}`, cell: (s) => <StatusBadge s={s} /> },
    { id: "created", header: "Invited", sortValue: (s) => s.createdAt ?? "", hideOnMobile: true, cell: (s) => <span className="text-ink-2">{fmtDate(s.createdAt)}</span> },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      mobileLabel: "Actions",
      align: "right",
      cell: (s) => (s.sub === me ? <span className="whitespace-nowrap text-xs text-ink-3">Another superadmin manages your account</span> : <StaffRowMenu s={s} last={lastSuperadmin(s)} />),
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <DataTable
        caption="Staff"
        rows={staff}
        columns={columns}
        rowKey={(s) => s.sub}
        initialSort={{ id: "role", dir: "ascending" }}
        minWidth={760}
        maxHeight="72dvh"
        empty="No staff yet."
      />
      <InviteForm />
    </div>
  );
}

type RowAction = "role" | "resend" | "reset" | "disable" | "enable" | "remove";

/**
 * One "Manage" menu per staff member instead of a row of buttons. Each item opens its confirmation;
 * focus goes back to the menu button when the dialog closes. Actions the server would refuse (the
 * last superadmin) stay in the menu, disabled, with the reason under them.
 */
function StaffRowMenu({ s, last }: { s: StaffRow; last: boolean }) {
  const [open, setOpen] = useState<RowAction | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const choose = (a: RowAction, close: () => void) => {
    close();
    // the dialog returns focus to whatever was focused when it opened: make that the menu button
    wrap.current?.querySelector<HTMLButtonElement>("button")?.focus();
    setOpen(a);
  };
  const shut = () => setOpen(null);
  const invited = s.status === "FORCE_CHANGE_PASSWORD";

  const item = (a: RowAction, label: string, close: () => void, opts: { danger?: boolean; blocked?: string } = {}) => (
    <button
      key={a}
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={opts.blocked ? true : undefined}
      onClick={() => (opts.blocked ? undefined : choose(a, close))}
      className={`${menuItemClass} flex-col !items-start !gap-0 ${opts.blocked ? "cursor-not-allowed opacity-60" : ""} ${opts.danger && !opts.blocked ? "!text-destructive hover:!bg-destructive-wash" : ""}`}
    >
      <span>{label}</span>
      {opts.blocked ? <span className="text-xs text-ink-3">{opts.blocked}</span> : null}
    </button>
  );

  return (
    <div ref={wrap} className="inline-flex justify-end">
      <Dropdown
        label={`Manage ${s.name}`}
        title={s.name}
        align="right"
        width="w-64"
        triggerClassName={buttonClass("secondary", "sm")}
        trigger={
          <>
            Manage
            <IconChevronDown size={14} aria-hidden />
          </>
        }
      >
        {(close) => (
          <>
            {item("role", "Change role", close, { blocked: last ? "Last superadmin. Make someone else superadmin first." : undefined })}
            {s.enabled && invited ? item("resend", "Resend invite", close) : null}
            {s.enabled && !invited ? item("reset", "Reset password", close) : null}
            <MenuSeparator />
            {s.enabled ? item("disable", "Disable account", close, { danger: true, blocked: last ? "Last superadmin." : undefined }) : item("enable", "Enable account", close)}
            {item("remove", "Remove from staff", close, { danger: true, blocked: last ? "Last superadmin." : undefined })}
          </>
        )}
      </Dropdown>

      <ActionConfirm
        open={open === "role"}
        onClose={shut}
        title={`Change ${s.name}'s staff role`}
        description={`Currently ${PLATFORM_ROLE_INFO[s.role].label}. They're signed out and get the new role at their next sign-in.`}
        confirmLabel="Change role"
        pendingLabel="Changing role"
        action={changeStaffRole}
        hidden={{ sub: s.sub }}
      >
        {(state) => (
          <SelectField
            id={`role-${s.sub}`}
            name="role"
            label="New role"
            defaultValue={PLATFORM_ROLES.find((r) => r !== s.role)}
            options={roleOptions.filter((o) => o.value !== s.role)}
            error={state?.fieldErrors?.role}
          />
        )}
      </ActionConfirm>
      <ActionConfirm
        open={open === "resend"}
        onClose={shut}
        title={`Resend ${s.name}'s invite?`}
        description={`Cognito emails ${s.email} a new temporary password, valid for 1 day. The old one stops working.`}
        confirmLabel="Resend invite"
        pendingLabel="Sending"
        action={resendStaffInvite}
        hidden={{ sub: s.sub }}
      />
      <ActionConfirm
        open={open === "reset"}
        onClose={shut}
        title={`Reset ${s.name}'s password?`}
        description={`Signs them out and emails ${s.email} a temporary password. They choose a new password at their next sign-in; their authenticator app stays set up. Confirm who you're talking to first.`}
        confirmLabel="Reset password"
        pendingLabel="Resetting"
        action={resetStaffPassword}
        hidden={{ sub: s.sub }}
      />
      <ActionConfirm
        open={open === "disable"}
        onClose={shut}
        danger
        title={`Disable ${s.name}?`}
        description="They're signed out of the console now and can't sign in until someone enables the account again."
        confirmLabel="Disable account"
        pendingLabel="Disabling"
        action={setStaffEnabled}
        hidden={{ sub: s.sub, enabled: "false" }}
      />
      <ActionConfirm
        open={open === "enable"}
        onClose={shut}
        title={`Enable ${s.name}?`}
        description="They can sign in to the console again with their password and authenticator app."
        confirmLabel="Enable account"
        pendingLabel="Enabling"
        action={setStaffEnabled}
        hidden={{ sub: s.sub, enabled: "true" }}
      />
      <ActionConfirm
        open={open === "remove"}
        onClose={shut}
        danger
        typeToConfirm={s.email}
        title={`Remove ${s.name} from staff?`}
        description="Deletes their staff account, password and authenticator. To give them access again, send a new invite."
        confirmLabel="Remove staff account"
        pendingLabel="Removing"
        action={removeStaffMember}
        hidden={{ sub: s.sub }}
      />
    </div>
  );
}

function InviteForm() {
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, data) => {
    const r = await inviteStaffMember(prev, data);
    if (r?.ok) {
      toast(r.ok);
      form.current?.reset();
    }
    return r;
  }, null);
  useFocusOnError(state, form);
  return (
    <Card aria-labelledby="invite-h">
      <CardHeader
        titleId="invite-h"
        title="Invite someone to the team"
        description={
          <>
            Cognito emails them a temporary password, valid for 1 day. At <span className="font-mono">/admin/login</span> they choose a password and set up an authenticator app.
          </>
        }
      />
      <CardBody>
        <form ref={form} action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] xl:items-start" noValidate>
          <FormGuard />
          <TextField id="invite-name" name="name" required minLength={2} maxLength={100} label="Full name" autoComplete="off" error={state?.fieldErrors?.name} />
          <TextField id="invite-email" name="email" type="email" required maxLength={254} label="Work email" placeholder="name@theplaintheory.in" autoComplete="off" error={state?.fieldErrors?.email} />
          <SelectField
            id="invite-role"
            name="role"
            label="Staff role"
            defaultValue="analyst"
            options={PLATFORM_ROLES.map((r) => ({ value: r, label: PLATFORM_ROLE_INFO[r].label, description: PLATFORM_ROLE_INFO[r].summary }))}
            menuWidth={320}
            error={state?.fieldErrors?.role}
          />
          {/* lines the button up with the fields, under their label row */}
          <div className="xl:pt-[26px]">
            <SubmitButton pending="Inviting" className="w-full xl:w-auto">
              Send invite
            </SubmitButton>
          </div>
        </form>
        {state?.error ? (
          <div className="mt-4">
            <FormMessage state={{ error: state.error }} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
