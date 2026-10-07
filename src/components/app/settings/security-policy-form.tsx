"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { updateSecuritySettings } from "@/app/app/settings/actions";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { Switch } from "@/components/app/ui/switch";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

export function SecurityPolicyForm({ requireMfa, canEdit, ownMfa, unenrolled }: { requireMfa: boolean; canEdit: boolean; ownMfa: boolean; unenrolled: number }) {
  const [state, action] = useActionState<ActionResult, FormData>(updateSecuritySettings, null);
  const [on, setOn] = useState(requireMfa);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) toast(state.ok);
  }, [state, toast]);

  return (
    <form action={action} noValidate>
      <SettingsSection
        title="Sign-in security"
        description={
          <>
            Sessions end after 30 minutes idle or 12 hours. Every change is recorded in the <Link href="/app/audit" className="underline underline-offset-2 hover:text-ink">audit log</Link>.
          </>
        }
      >
        <SettingsRow
          label="Require two-factor"
          description={
            unenrolled
              ? `${unenrolled} ${unenrolled > 1 ? "members haven't" : "member hasn't"} turned on two-factor yet. When required, they're asked to set it up before they can continue.`
              : "Everyone in this organization has two-factor on."
          }
        >
          <Switch
            name="requireMfa"
            checked={on}
            onChange={setOn}
            disabled={!canEdit}
            label="Require two-factor for all members"
            description={!canEdit ? "Only owners can change this." : !ownMfa ? "Turn on two-factor for your own account first, in Account." : "Members without two-factor are asked to set it up at their next sign-in."}
          />
          {canEdit ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SubmitButton pending="Saving" variant="ghost" disabled={on === requireMfa}>
                Save security policy
              </SubmitButton>
              {state?.error ? <FormMessage state={state} /> : null}
            </div>
          ) : null}
        </SettingsRow>
      </SettingsSection>
    </form>
  );
}
