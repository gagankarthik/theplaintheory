"use client";

import { changeOrgPlan, clearLegalHold, setLegalHold, suspendOrg, unsuspendOrg } from "@/app/admin/actions";
import { SelectField, TextAreaField } from "@/components/app/ui/field";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";
import { ActionDialog } from "./action-dialog";

export function OrgActions({
  org,
  canPlan,
  canSuspend,
  canLegalHold = false,
}: {
  org: { id: string; name: string; plan: PlanId; suspended: boolean; hasStripe: boolean; legalHold?: boolean };
  canPlan: boolean;
  canSuspend: boolean;
  canLegalHold?: boolean;
}) {
  if (!canPlan && !canSuspend && !canLegalHold) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
      {canPlan ? (
        <ActionDialog
          trigger="Change plan"
          title={`Change plan for ${org.name}`}
          description="A complimentary change, made outside Stripe. Members see the new plan's limits straight away."
          confirmLabel="Change plan"
          pendingLabel="Changing plan"
          action={changeOrgPlan}
          hidden={{ orgId: org.id }}
        >
          {(state) => (
            <>
              <SelectField
                id="plan"
                name="plan"
                label="New plan"
                defaultValue={PLANS.find((p) => p.id !== org.plan)?.id}
                options={PLANS.filter((p) => p.id !== org.plan).map((p) => ({ value: p.id, label: `${p.name}${p.priceMonthly === null ? " (custom)" : ` ($${p.priceMonthly}/mo)`}` }))}
                hint={`Currently ${PLANS.find((p) => p.id === org.plan)?.name}.`}
                error={state?.fieldErrors?.plan}
              />
              <TextAreaField id="note" name="note" label="Internal note (optional)" rows={2} maxLength={300} placeholder="e.g. Partner comp, approved by sales" error={state?.fieldErrors?.note} />
              {org.hasStripe ? (
                <p className="rounded-md bg-amber-wash px-3 py-2 text-sm text-amber">
                  This organization has a Stripe subscription. The next Stripe webhook may set the plan back to what they pay for.
                </p>
              ) : null}
            </>
          )}
        </ActionDialog>
      ) : null}
      {canSuspend ? (
        org.suspended ? (
          <ActionDialog
            trigger="Lift suspension"
            title={`Lift the suspension of ${org.name}?`}
            description="Members get their dashboard back on their next page load."
            confirmLabel="Lift suspension"
            pendingLabel="Lifting"
            action={unsuspendOrg}
            hidden={{ orgId: org.id }}
          />
        ) : (
          <ActionDialog
            trigger="Suspend"
            triggerVariant="danger"
            danger
            title={`Suspend ${org.name}?`}
            description="Members lose dashboard and API access and see a suspension notice with your reason. Published banners keep working on their sites and no data is deleted."
            confirmLabel="Suspend organization"
            pendingLabel="Suspending"
            action={suspendOrg}
            hidden={{ orgId: org.id }}
          >
            {(state) => (
              <TextAreaField
                id="reason"
                name="reason"
                label="Reason shown to members"
                rows={3}
                required
                maxLength={300}
                placeholder="e.g. Payment overdue since 1 October. Contact billing@theplaintheory.in."
                error={state?.fieldErrors?.reason}
              />
            )}
          </ActionDialog>
        )
      ) : null}
      {canLegalHold ? (
        org.legalHold ? (
          <ActionDialog
            trigger="Lift legal hold"
            title={`Lift the legal hold on ${org.name}?`}
            description="The next retention run applies their normal retention, so records past it are deleted then."
            confirmLabel="Lift legal hold"
            pendingLabel="Lifting"
            action={clearLegalHold}
            hidden={{ orgId: org.id }}
          />
        ) : (
          <ActionDialog
            trigger="Legal hold"
            title={`Place ${org.name} under legal hold?`}
            description="The retention job deletes nothing for this organization until the hold is lifted: consent receipts, leak reports and webhook logs are all kept."
            confirmLabel="Place legal hold"
            pendingLabel="Placing hold"
            action={setLegalHold}
            hidden={{ orgId: org.id }}
          >
            {(state) => (
              <TextAreaField
                id="hold-reason"
                name="reason"
                label="Reason (internal, optional)"
                rows={2}
                maxLength={300}
                placeholder="e.g. Litigation hold requested by counsel, ref. 2026-114"
                error={state?.fieldErrors?.reason}
              />
            )}
          </ActionDialog>
        )
      ) : null}
    </div>
  );
}
