"use client";

import { useActionState, useRef } from "react";
import { changeStaffRole, inviteStaffMember, removeStaffMember, resendStaffInvite, resetStaffPassword, setStaffEnabled } from "@/app/admin/actions";
import { Badge } from "@/components/app/ui/badge";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { SelectField, TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import { PLATFORM_ROLES, PLATFORM_ROLE_INFO, type PlatformRole } from "@/lib/auth/platform";
import { ActionDialog } from "./action-dialog";
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
  if (!s.enabled) return <Badge tone="declined">Disabled</Badge>;
  if (s.status === "FORCE_CHANGE_PASSWORD") return <Badge tone="held">Invited</Badge>;
  if (s.status === "CONFIRMED") return <Badge tone="released">Active</Badge>;
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
          <span className="font-bold">
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
      cell: (s) => {
        if (s.sub === me) return <span className="whitespace-nowrap text-xs text-ink-3">Another superadmin manages your account</span>;
        const last = lastSuperadmin(s);
        const who = <span className="sr-only"> for {s.name}</span>;
        return (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <ActionDialog
              trigger={<>Change role{who}</>}
              title={`Change ${s.name}'s staff role`}
              description={`Currently ${PLATFORM_ROLE_INFO[s.role].label}. They're signed out and get the new role at their next sign-in.`}
              confirmLabel="Change role"
              pendingLabel="Changing role"
              action={changeStaffRole}
              hidden={{ sub: s.sub }}
              disabled={last}
              disabledReason={last ? "Last superadmin. Make someone else superadmin first." : undefined}
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
            </ActionDialog>
            {s.enabled && s.status === "FORCE_CHANGE_PASSWORD" ? (
              <ActionDialog
                trigger={<>Resend invite{who}</>}
                title={`Resend ${s.name}'s invite?`}
                description={`Cognito emails ${s.email} a new temporary password, valid for 1 day. The old one stops working.`}
                confirmLabel="Resend invite"
                pendingLabel="Sending"
                action={resendStaffInvite}
                hidden={{ sub: s.sub }}
              />
            ) : null}
            {s.enabled && s.status !== "FORCE_CHANGE_PASSWORD" ? (
              <ActionDialog
                trigger={<>Reset password{who}</>}
                title={`Reset ${s.name}'s password?`}
                description={`Signs them out and emails ${s.email} a temporary password. They choose a new password at their next sign-in; their authenticator app stays set up. Confirm who you're talking to first.`}
                confirmLabel="Reset password"
                pendingLabel="Resetting"
                action={resetStaffPassword}
                hidden={{ sub: s.sub }}
              />
            ) : null}
            {s.enabled ? (
              <ActionDialog
                trigger={<>Disable{who}</>}
                triggerVariant="danger"
                danger
                title={`Disable ${s.name}?`}
                description="They're signed out of the console now and can't sign in until someone enables the account again."
                confirmLabel="Disable account"
                pendingLabel="Disabling"
                action={setStaffEnabled}
                hidden={{ sub: s.sub, enabled: "false" }}
                disabled={last}
                disabledReason={last ? "Last superadmin." : undefined}
              />
            ) : (
              <ActionDialog
                trigger={<>Enable{who}</>}
                title={`Enable ${s.name}?`}
                description="They can sign in to the console again with their password and authenticator app."
                confirmLabel="Enable account"
                pendingLabel="Enabling"
                action={setStaffEnabled}
                hidden={{ sub: s.sub, enabled: "true" }}
              />
            )}
            <ActionDialog
              trigger={<>Remove{who}</>}
              triggerVariant="danger"
              danger
              title={`Remove ${s.name} from staff?`}
              description="Deletes their staff account, password and authenticator. To give them access again, send a new invite."
              confirmLabel="Remove staff account"
              pendingLabel="Removing"
              action={removeStaffMember}
              hidden={{ sub: s.sub }}
              disabled={last}
              disabledReason={last ? "Last superadmin." : undefined}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-10">
      <DataTable caption="Staff" rows={staff} columns={columns} rowKey={(s) => s.sub} initialSort={{ id: "role", dir: "ascending" }} minWidth={980} empty="No staff yet." />
      <InviteForm />
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
    <section aria-labelledby="invite-h" className="border-t border-line pt-8">
      <h2 id="invite-h" className="text-lg font-bold">
        Invite someone to the team
      </h2>
      <p className="mb-5 text-sm text-ink-3">
        Cognito emails them a temporary password, valid for 1 day. At <span className="font-mono">/admin/login</span> they choose a password and set up an authenticator app.
      </p>
      <form ref={form} action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] xl:items-start" noValidate>
        <FormGuard />
        <TextField id="invite-name" name="name" required minLength={2} maxLength={100} label="Full name" autoComplete="off" error={state?.fieldErrors?.name} />
        <TextField id="invite-email" name="email" type="email" required maxLength={254} label="Work email" placeholder="name@theplaintheory.in" autoComplete="off" error={state?.fieldErrors?.email} />
        <SelectField
          id="invite-role"
          name="role"
          label="Staff role"
          defaultValue="analyst"
          options={PLATFORM_ROLES.map((r) => ({ value: r, label: PLATFORM_ROLE_INFO[r].label }))}
          error={state?.fieldErrors?.role}
        />
        <div className="xl:pt-[26px]">
          <SubmitButton pending="Inviting" className="w-full max-sm:h-11 xl:w-auto">
            Send invite
          </SubmitButton>
        </div>
      </form>
      <div className="mt-4" aria-live="polite">
        <FormMessage state={state} />
      </div>
    </section>
  );
}
