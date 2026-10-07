"use client";

import { useActionState, useState } from "react";
import { saveNoticeSettings, type NoticeState } from "@/app/app/sites/[propertyId]/actions";
import type { BannerConfig } from "@/lib/types";
import { TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { Switch } from "@/components/app/ui/switch";
import { FormMessage } from "@/components/app/ui/toast";

/** Rights, grievance and behaviour settings shown in every notice (DPDPA Rule 3, s.6(4); re-ask suppression). */
export function NoticeSettings({
  propertyId,
  config,
  dpoEmail,
  canWrite,
}: {
  propertyId: string;
  config: BannerConfig;
  dpoEmail?: string;
  canWrite: boolean;
}) {
  const [state, action] = useActionState<NoticeState, FormData>(saveNoticeSettings.bind(null, propertyId), null);
  const [leaks, setLeaks] = useState(config.leakDetection ?? true);
  const fe = state?.fieldErrors ?? {};
  // After a failed save React resets the form, so fall back to what was submitted.
  const v = (k: string, saved: string | number | undefined) => state?.values?.[k] ?? String(saved ?? "");

  return (
    <form id="notice" action={action} className="scroll-mt-24" noValidate>
      <fieldset disabled={!canWrite} className="min-w-0">
        <legend className="sr-only">Notice details</legend>
        <SettingsSection
          title="Rights and contacts"
          description="Shown in the DPDPA notice and the preferences view so people know how to act on their data."
        >
          <SettingsRow label="Exercise your rights" htmlFor="rightsUrl" description="Where people ask to access, correct or erase their data.">
            <TextField id="rightsUrl" name="rightsUrl" label="Rights page URL" hideLabel type="url" placeholder="https://example.com/privacy#rights" defaultValue={v("rightsUrl", config.rights?.rightsUrl)} error={fe.rightsUrl} />
          </SettingsRow>
          <SettingsRow
            label="Grievance contact"
            htmlFor="grievanceEmail"
            description={dpoEmail ? `Leave empty to use your DPO, ${dpoEmail}. Grievances must be answered within 90 days.` : "Grievances must be answered within 90 days (Rule 14)."}
          >
            <TextField id="grievanceEmail" name="grievanceEmail" label="Grievance email" hideLabel type="email" placeholder={dpoEmail ?? "grievance@example.com"} defaultValue={v("grievanceEmail", config.rights?.grievanceEmail)} error={fe.grievanceEmail} />
          </SettingsRow>
          <SettingsRow
            label="Data Protection Board"
            htmlFor="boardComplaintUrl"
            description="Where people can complain to the Board. Add it once the Board publishes its complaint channel."
          >
            <TextField id="boardComplaintUrl" name="boardComplaintUrl" label="Board complaint URL" hideLabel type="url" placeholder="https://" defaultValue={v("boardComplaintUrl", config.rights?.boardComplaintUrl)} error={fe.boardComplaintUrl} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Behaviour after a choice">
          <SettingsRow
            label="After someone rejects"
            htmlFor="reaskAfterRejectDays"
            description="Don't show the banner again for this long. 180 days matches the EU's proposed cookie rules and avoids consent fatigue."
          >
            <div className="flex items-center gap-3">
              <TextField
                id="reaskAfterRejectDays"
                name="reaskAfterRejectDays"
                label="Days before asking again"
                hideLabel
                type="number"
                min={0}
                max={395}
                inputMode="numeric"
                className="w-32"
                controlClassName="tabular-nums"
                defaultValue={v("reaskAfterRejectDays", config.reaskAfterRejectDays ?? 180)}
                error={fe.reaskAfterRejectDays}
              />
              <span className="text-sm text-ink-3">days</span>
            </div>
          </SettingsRow>
          <SettingsRow label="Leak detection" description="The script reports tracker requests that still fire after a visitor declines. No personal data is sent, only the request host and page.">
            <Switch label={leaks ? "Reporting leaks" : "Off"} checked={leaks} onChange={setLeaks} name="leakDetection" />
          </SettingsRow>
        </SettingsSection>
      </fieldset>
      {canWrite ? (
        <div className="flex flex-col items-end gap-3 pb-4">
          <div className="w-full max-w-xl">
            <FormMessage state={state?.fieldErrors ? { error: state.error } : state} />
          </div>
          <SubmitButton variant="ghost" pending="Saving">
            Save notice details
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
