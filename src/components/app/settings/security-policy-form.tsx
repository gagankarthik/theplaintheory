"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateSecuritySettings } from "@/app/app/settings/actions";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { Switch } from "@/components/app/ui/switch";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

export function SecurityPolicyForm({ requireMfa, canEdit, ownMfa, unenrolled }: { requireMfa: boolean; canEdit: boolean; ownMfa: boolean; unenrolled: number }) {
  const toast = useToast();
  const [on, setOn] = useState(requireMfa);
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await updateSecuritySettings(prev, form);
    if (r?.ok && !r.error) {
      toast(r.ok);
      return null;
    }
    return r;
  }, null);
  const dirty = on !== requireMfa;

  return (
    <form action={action} noValidate>
      <SettingsSection
        id="sign-in-security"
        title="Sign-in security"
        description={
          <>
            Sessions end after 30 minutes idle or 12 hours. Changes are recorded in the{" "}
            <Link href="/app/audit" className="font-medium text-ink underline underline-offset-4">
              audit log
            </Link>
            .
          </>
        }
        footer={
          canEdit ? (
            <>
              {state?.error ? (
                <div className="mr-auto min-w-0 flex-1">
                  <FormMessage state={state} />
                </div>
              ) : null}
              <SubmitButton pending="Saving" variant={dirty ? "primary" : "secondary"} disabled={!dirty}>
                Save
              </SubmitButton>
            </>
          ) : (
            <p className="mr-auto text-xs text-ink-3">Only owners can change the sign-in policy.</p>
          )
        }
      >
        <SettingsRow
          label="Require two-factor"
          description={
            unenrolled
              ? `${unenrolled} ${unenrolled > 1 ? "members haven't" : "member hasn't"} turned it on yet.`
              : "Everyone in this organization has two-factor on."
          }
        >
          <Switch
            name="requireMfa"
            checked={on}
            onChange={setOn}
            disabled={!canEdit}
            label="Require two-factor for all members"
            description={
              !canEdit ? undefined : !ownMfa ? (
                <>
                  Turn on two-factor for your own account first, in{" "}
                  <Link href="/app/account#two-factor" className="font-medium text-ink underline underline-offset-4">
                    Account
                  </Link>
                  .
                </>
              ) : (
                "Members without it set it up at their next sign-in."
              )
            }
          />
        </SettingsRow>
      </SettingsSection>
    </form>
  );
}
