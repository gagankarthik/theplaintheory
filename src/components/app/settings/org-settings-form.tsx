"use client";

import { useActionState, useEffect } from "react";
import { updateOrgSettings } from "@/app/app/settings/actions";
import { SelectField, TextAreaField, TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import { DATA_REGIONS } from "@/lib/regions";
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
            description="Consent receipts for this organization are written to this AWS region. For DPDPA, choose Mumbai or Hyderabad."
          >
            <SelectField
              id="dataRegion"
              label="Storage region"
              hideLabel
              defaultValue={org.dataRegion}
              options={DATA_REGIONS.map((r) => ({ value: r.id, label: r.label }))}
              hint="Changing this applies to new receipts. Existing receipts stay where they were written."
              error={fe?.dataRegion}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
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
