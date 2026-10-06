"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/app/ui/toast";
import { SelectField, TextField } from "@/components/app/ui/field";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { DATA_REGIONS } from "@/lib/regions";
import { createWorkspace, type OnboardState } from "./actions";

export function OnboardingForm() {
  const [state, action] = useActionState<OnboardState, FormData>(createWorkspace, null);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-bold text-ink">Organization</legend>
        <TextField id="org" label="Organization name" required placeholder="Acme Retail Pvt Ltd" autoComplete="organization" error={fe?.org} />
        <SelectField
          id="dataRegion"
          label="Where consent records are stored"
          defaultValue="ap-south-1"
          options={DATA_REGIONS.map((r) => ({ value: r.id, label: r.label }))}
          hint="Pick Mumbai or Hyderabad to keep Indian visitors' records in India."
          error={fe?.dataRegion}
        />
      </fieldset>
      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="float-left mb-1 w-full text-base font-bold text-ink">First site</legend>
        <TextField id="site" label="Site name" required placeholder="Acme storefront" error={fe?.site} className="clear-left" />
        <TextField id="domain" label="Domain" required placeholder="acme.in" inputMode="url" autoCapitalize="none" error={fe?.domain} />
      </fieldset>
      <FormMessage state={state && !state.fieldErrors ? state : null} />
      <SubmitButton className="w-full" pending="Creating workspace">
        Create workspace
      </SubmitButton>
    </form>
  );
}
