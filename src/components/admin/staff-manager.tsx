"use client";

import { useActionState, useRef } from "react";
import { grantStaffRole, revokeStaffRole } from "@/app/admin/actions";
import { Badge } from "@/components/app/ui/badge";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { SelectField, TextField } from "@/components/app/ui/field";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import { PLATFORM_ROLES, PLATFORM_ROLE_INFO, type PlatformRole } from "@/lib/auth/platform";
import { ActionDialog } from "./action-dialog";
import { MfaBadge, StaffRoleBadge } from "./badges";
import { fmtDate } from "./format";

export interface StaffRow {
  userId: string;
  name: string;
  email: string;
  role: PlatformRole;
  bootstrap: boolean;
  mfa: boolean;
  lastActiveAt?: string;
}

const roleOptions = PLATFORM_ROLES.map((r) => ({ value: r, label: `${PLATFORM_ROLE_INFO[r].label}: ${PLATFORM_ROLE_INFO[r].summary}` }));

export function StaffManager({ staff, me, canManage }: { staff: StaffRow[]; me: string; canManage: boolean }) {
  const superadmins = staff.filter((s) => s.role === "superadmin").length;
  /** Same rules the server enforces (staffChangeProblem); the UI just explains them up front. */
  const lockReason = (s: StaffRow) =>
    s.userId === me ? "Your own role" : s.bootstrap ? "Set by env var" : s.role === "superadmin" && superadmins <= 1 ? "Last superadmin" : null;

  const columns: Column<StaffRow>[] = [
    {
      id: "name",
      header: "Staff member",
      sortValue: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <>
          <span className="font-bold">
            {s.name}
            {s.userId === me ? <span className="font-normal text-ink-3"> (you)</span> : null}
          </span>
          <span className="block truncate text-xs text-ink-3">{s.email}</span>
        </>
      ),
    },
    {
      id: "role",
      header: "Role",
      sortValue: (s) => PLATFORM_ROLES.indexOf(s.role),
      cell: (s) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StaffRoleBadge role={s.role} />
          {s.bootstrap ? <Badge tone="neutral">Env bootstrap</Badge> : null}
        </span>
      ),
    },
    { id: "mfa", header: "Two-factor", sortValue: (s) => (s.mfa ? 1 : 0), cell: (s) => <MfaBadge on={s.mfa} /> },
    { id: "active", header: "Last active", sortValue: (s) => s.lastActiveAt ?? "", cell: (s) => <span className="text-ink-2">{fmtDate(s.lastActiveAt)}</span> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            mobileLabel: "Actions",
            align: "right" as const,
            cell: (s: StaffRow) => {
              const reason = lockReason(s);
              if (reason) return <span className="whitespace-nowrap text-xs text-ink-3">Locked: {reason.toLowerCase()}</span>;
              return (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                  <ActionDialog
                    trigger={
                      <>
                        Change role<span className="sr-only"> for {s.name}</span>
                      </>
                    }
                    title={`Change ${s.name}'s staff role`}
                    description={`Currently ${PLATFORM_ROLE_INFO[s.role].label}. Takes effect on their next request.`}
                    confirmLabel="Change role"
                    pendingLabel="Changing role"
                    action={grantStaffRole}
                    hidden={{ email: s.email }}
                  >
                    {(state) => (
                      <SelectField
                        id={`role-${s.userId}`}
                        name="role"
                        label="New role"
                        defaultValue={PLATFORM_ROLES.find((r) => r !== s.role)}
                        options={roleOptions.filter((o) => o.value !== s.role)}
                        error={state?.fieldErrors?.role}
                      />
                    )}
                  </ActionDialog>
                  <ActionDialog
                    trigger={
                      <>
                        Remove<span className="sr-only"> {s.name} from staff</span>
                      </>
                    }
                    triggerVariant="danger"
                    danger
                    title={`Remove ${s.name} from staff?`}
                    description="They keep their customer account and memberships but lose the staff console on their next request."
                    confirmLabel="Remove staff access"
                    pendingLabel="Removing"
                    action={revokeStaffRole}
                    hidden={{ userId: s.userId }}
                  />
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-10">
      <DataTable caption="Staff" rows={staff} columns={columns} rowKey={(s) => s.userId} initialSort={{ id: "role", dir: "ascending" }} minWidth={820} empty="No staff yet." />
      {canManage ? <GrantForm /> : null}
    </div>
  );
}

function GrantForm() {
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, data) => {
    const r = await grantStaffRole(prev, data);
    if (r?.ok) {
      toast(r.ok);
      form.current?.reset();
    }
    return r;
  }, null);
  return (
    <section aria-labelledby="grant-h" className="border-t border-line pt-8">
      <h2 id="grant-h" className="text-lg font-bold">
        Add someone to the team
      </h2>
      <p className="mb-5 text-sm text-ink-3">They need a Plain Theory account first. In production, staff must turn on two-factor before the console opens for them.</p>
      <form ref={form} action={action} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start" noValidate>
        <TextField id="grant-email" name="email" type="email" required maxLength={254} label="Account email" placeholder="name@theplaintheory.com" autoComplete="off" error={state?.fieldErrors?.email} />
        <SelectField
          id="grant-role"
          name="role"
          label="Staff role"
          defaultValue="analyst"
          options={PLATFORM_ROLES.map((r) => ({ value: r, label: PLATFORM_ROLE_INFO[r].label }))}
          error={state?.fieldErrors?.role}
        />
        <div className="md:pt-[26px]">
          <SubmitButton pending="Adding" className="w-full max-sm:h-11 md:w-auto">
            Add to staff
          </SubmitButton>
        </div>
      </form>
      <div className="mt-4" aria-live="polite">
        <FormMessage state={state} />
      </div>
    </section>
  );
}
