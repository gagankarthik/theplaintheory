"use client";

import { changeOrgPlan, suspendOrg, unsuspendOrg } from "@/app/admin/actions";
import { SelectField, TextAreaField } from "@/components/app/ui/field";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";
import { ActionDialog } from "./action-dialog";

export function OrgActions({
  org,
  canPlan,
  canSuspend,
}: {
  org: { id: string; name: string; plan: PlanId; suspended: boolean; hasStripe: boolean };
  canPlan: boolean;
  canSuspend: boolean;
}) {
  if (!canPlan && !canSuspend) return null;
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
                placeholder="e.g. Payment overdue since 1 October. Contact billing@theplaintheory.com."
                error={state?.fieldErrors?.reason}
              />
            )}
          </ActionDialog>
        )
      ) : null}
    </div>
  );
}
