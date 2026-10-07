"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { updateOrgSettings } from "@/app/app/settings/actions";
import { TextAreaField, TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import { regionLabel } from "@/lib/regions";
import type { Organization } from "@/lib/types";

export function OrgSettingsForm({ org, canEdit }: { org: Pick<Organization, "name" | "dataRegion" | "dpo">; canEdit: boolean }) {
  const [state, action] = useActionState<ActionResult, FormData>(updateOrgSettings, null);
  const toast = useToast();
  const fe = state?.fieldErrors;
  useEffect(() => {
    if (state?.ok) toast(state.ok);
  }, [state, toast]);

  return (
    <form action={action} noValidate>
      <fieldset disabled={!canEdit} className="min-w-0">
        <legend className="sr-only">Organization settings</legend>
        <SettingsSection title="Organization">
          <SettingsRow label="Name" description="Shown to your team and on audit reports.">
            <TextField id="name" label="Organization name" hideLabel defaultValue={org.name} required error={fe?.name} />
          </SettingsRow>
          <SettingsRow
            label="Where records are stored"
            description="Consent receipts, audit events and statistics for this organization are stored in this AWS region. It's set when the organization is created."
          >
            <p className="text-sm font-semibold text-ink">{regionLabel(org.dataRegion)}</p>
            <p className="mt-1 text-xs text-ink-3">
              To move existing records to another region, <Link className="font-semibold text-brand underline-offset-2 hover:underline" href="/contact/support">contact support</Link>.
            </p>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          id="dpo"
          title="Data Protection Officer"
          description="India's DPDP Act requires the notice to name someone visitors can contact about their data. Leave empty if you don't have a DPO."
        >
          <SettingsRow label="Name">
            <TextField id="dpoName" label="DPO name" hideLabel defaultValue={org.dpo?.name} autoComplete="off" error={fe?.dpoName} />
          </SettingsRow>
          <SettingsRow label="Email" description="Shown on the DPDPA notice.">
            <TextField id="dpoEmail" type="email" maxLength={254} label="DPO email" hideLabel defaultValue={org.dpo?.email} autoComplete="off" error={fe?.dpoEmail} />
          </SettingsRow>
          <SettingsRow label="Postal address" description="Optional. Included in audit reports.">
            <TextAreaField id="dpoAddress" label="DPO postal address" hideLabel rows={3} defaultValue={org.dpo?.address} error={fe?.dpoAddress} />
          </SettingsRow>
        </SettingsSection>
      </fieldset>
      {canEdit ? (
        <div className="flex flex-col items-end gap-3 border-t border-line pt-6">
          {state?.error ? <FormMessage state={state} /> : null}
          <SubmitButton pending="Saving">Save settings</SubmitButton>
        </div>
      ) : (
        <p className="border-t border-line pt-6 text-sm text-ink-3">Only owners and admins can change these settings.</p>
      )}
    </form>
  );
}
