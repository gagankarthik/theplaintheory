"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { updateOrgSettings } from "@/app/app/settings/actions";
import { TextAreaField, TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import { regionLabel } from "@/lib/regions";
import type { Organization } from "@/lib/types";

type OrgFields = Pick<Organization, "name" | "dataRegion" | "dpo">;

/**
 * One settings section, saved on its own. The server action takes the whole record, so the fields
 * of the other section ride along as hidden inputs holding their saved values. The Save button
 * turns primary only once something in this section changed, so a page never shows two at once.
 */
function SectionForm({
  id,
  title,
  description,
  canEdit,
  hidden,
  successMessage,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  canEdit: boolean;
  hidden: Record<string, string>;
  /** toast text on success; the server's message when left out */
  successMessage?: string;
  children: (errors: Record<string, string[] | undefined> | undefined) => ReactNode;
}) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await updateOrgSettings(prev, form);
    if (r?.ok && !r.error) {
      toast(successMessage ?? r.ok);
      setDirty(false);
      return null;
    }
    return r;
  }, null);

  return (
    <form action={action} noValidate onChange={() => setDirty(true)}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SettingsSection
        id={id}
        title={title}
        description={description}
        footer={
          canEdit ? (
            <>
              {state?.error && !state.fieldErrors ? (
                <div className="mr-auto min-w-0 flex-1">
                  <FormMessage state={state} />
                </div>
              ) : null}
              <SubmitButton pending="Saving" variant={dirty ? "primary" : "secondary"} disabled={!dirty}>
                Save
              </SubmitButton>
            </>
          ) : (
            <p className="mr-auto text-xs text-ink-3">Only owners and admins can change these settings.</p>
          )
        }
      >
        <fieldset disabled={!canEdit} className="min-w-0 divide-y divide-line">
          <legend className="sr-only">{title}</legend>
          {children(state?.fieldErrors)}
        </fieldset>
      </SettingsSection>
    </form>
  );
}

export function OrgSettingsForm({ org, canEdit }: { org: OrgFields; canEdit: boolean }) {
  const dpo = { dpoName: org.dpo?.name ?? "", dpoEmail: org.dpo?.email ?? "", dpoAddress: org.dpo?.address ?? "" };
  return (
    <>
      <SectionForm id="organization" title="Organization" description="How this organization is named and where its records live." canEdit={canEdit} hidden={dpo} successMessage="Organization details saved.">
        {(fe) => (
          <>
            <SettingsRow label="Name" description="Shown to your team and on audit reports.">
              <TextField id="name" label="Organization name" hideLabel defaultValue={org.name} required maxLength={80} error={fe?.name} />
            </SettingsRow>
            <SettingsRow label="Data region" description="Set when the organization is created.">
              <p className="text-sm font-medium text-ink">{regionLabel(org.dataRegion)}</p>
              <p className="mt-1 text-xs text-ink-3">
                Consent receipts, audit events and statistics are stored here. To move them,{" "}
                <Link className="font-medium text-ink underline underline-offset-4" href="/contact?topic=support">
                  contact support
                </Link>
                .
              </p>
            </SettingsRow>
          </>
        )}
      </SectionForm>

      <SectionForm
        id="dpo"
        title="Data Protection Officer"
        description="Named on your DPDPA notice so visitors can contact someone about their data. Leave empty if you don't have one."
        canEdit={canEdit}
        hidden={{ name: org.name }}
      >
        {(fe) => (
          <>
            <SettingsRow label="Name">
              <TextField id="dpoName" label="DPO name" hideLabel defaultValue={org.dpo?.name} maxLength={80} autoComplete="off" error={fe?.dpoName} />
            </SettingsRow>
            <SettingsRow label="Email" description="Shown on the DPDPA notice.">
              <TextField id="dpoEmail" type="email" maxLength={254} label="DPO email" hideLabel defaultValue={org.dpo?.email} autoComplete="off" error={fe?.dpoEmail} />
            </SettingsRow>
            <SettingsRow label="Postal address" description="Optional. Included in audit reports.">
              <TextAreaField id="dpoAddress" label="DPO postal address" hideLabel rows={3} maxLength={300} defaultValue={org.dpo?.address} error={fe?.dpoAddress} />
            </SettingsRow>
          </>
        )}
      </SectionForm>
    </>
  );
}
