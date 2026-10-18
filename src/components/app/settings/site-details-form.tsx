"use client";

import { useActionState, useState } from "react";
import { renameSite } from "@/app/app/sites/[propertyId]/actions";
import { CopyButton } from "@/components/app/ui/copy-button";
import { TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

/**
 * A site's own details: its name (editable), and the domain and site key the installed script uses
 * (read only, with copy). Save turns primary only once the name changes, so the page has one primary.
 */
export function SiteDetailsForm({ propertyId, name, domain, siteKey, canEdit }: { propertyId: string; name: string; domain: string; siteKey: string; canEdit: boolean }) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await renameSite(propertyId, prev, form);
    if (r?.ok && !r.error) {
      toast(r.ok);
      setDirty(false);
      return null;
    }
    return r;
  }, null);

  return (
    <form action={action} noValidate onChange={() => setDirty(true)}>
      <SettingsSection
        id="general"
        title="General"
        description="How this site is named in the dashboard, and the values your installed script uses."
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
            <p className="mr-auto text-xs text-ink-3">Only owners, admins and editors can rename a site.</p>
          )
        }
      >
        <fieldset disabled={!canEdit} className="min-w-0 divide-y divide-line">
          <legend className="sr-only">General</legend>
          <SettingsRow label="Name" description="Shown in the site switcher and on reports.">
            <TextField id="site-name" name="name" label="Site name" hideLabel defaultValue={name} required maxLength={60} error={state?.fieldErrors?.name} />
          </SettingsRow>
          <SettingsRow label="Domain" description="Set when the site was added. Subdomains share this site.">
            <p className="font-mono text-sm text-ink">{domain}</p>
          </SettingsRow>
          <SettingsRow label="Site key" description="Public. It goes in the script tag's data-site attribute.">
            <div className="flex flex-wrap items-center gap-3">
              <code id="site-key" className="rounded-[8px] bg-paper px-2.5 py-1.5 font-mono text-sm text-ink ring-1 ring-inset ring-line">
                {siteKey}
              </code>
              <CopyButton value={siteKey} label="Copy key" describedBy="site-key" />
            </div>
          </SettingsRow>
        </fieldset>
      </SettingsSection>
    </form>
  );
}
