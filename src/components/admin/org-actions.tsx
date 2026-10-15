"use client";

import { changeOrgPlan, clearLegalHold, setLegalHold, suspendOrg, unsuspendOrg } from "@/app/admin/actions";
import { Alert } from "@/components/app/ui/alert";
import { SelectField, TextAreaField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";
import { ActionDialog } from "./action-dialog";

interface OrgRef {
  id: string;
  name: string;
  plan: PlanId;
  suspended: boolean;
  hasStripe: boolean;
  legalHold?: boolean;
}

/** "Change plan" in the page header: a complimentary change made outside Stripe. */
export function OrgPlanAction({ org }: { org: OrgRef }) {
  return (
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
            <Alert tone="warning" title="Paid through Stripe">
              The next Stripe webhook may set the plan back to what they pay for.
            </Alert>
          ) : null}
        </>
      )}
    </ActionDialog>
  );
}

/**
 * Suspension and legal hold: the high-impact controls, kept together at the foot of the page in a
 * rose-edged section so they never sit next to everyday actions. Suspending and lifting a hold
 * (which lets retention delete records) both need the organization's name typed to confirm.
 */
export function OrgRiskActions({ org, canSuspend, canLegalHold }: { org: OrgRef; canSuspend: boolean; canLegalHold: boolean }) {
  if (!canSuspend && !canLegalHold) return null;
  return (
    <SettingsSection tone="danger" title="High-impact actions" description="Each one is recorded in the platform audit log with your name.">
      {canSuspend ? (
        <SettingsRow
          label={org.suspended ? "Lift suspension" : "Suspend organization"}
          description={
            org.suspended
              ? "Members get their dashboard back on their next page load."
              : "Members lose dashboard and API access and see your reason. Published banners keep working and no data is deleted."
          }
        >
          {org.suspended ? (
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
              trigger="Suspend organization"
              danger
              typeToConfirm={org.name}
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
          )}
        </SettingsRow>
      ) : null}
      {canLegalHold ? (
        <SettingsRow
          label={org.legalHold ? "Lift legal hold" : "Legal hold"}
          description={
            org.legalHold
              ? "The next retention run applies their normal retention, so records past it are deleted then."
              : "Retention deletes nothing for this organization until the hold is lifted: consent receipts, leak reports and webhook logs are all kept."
          }
        >
          {org.legalHold ? (
            <ActionDialog
              trigger="Lift legal hold"
              danger
              typeToConfirm={org.name}
              title={`Lift the legal hold on ${org.name}?`}
              description="The next retention run applies their normal retention, so records past it are deleted then."
              confirmLabel="Lift legal hold"
              pendingLabel="Lifting"
              action={clearLegalHold}
              hidden={{ orgId: org.id }}
            />
          ) : (
            <ActionDialog
              trigger="Place legal hold"
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
          )}
        </SettingsRow>
      ) : null}
    </SettingsSection>
  );
}
