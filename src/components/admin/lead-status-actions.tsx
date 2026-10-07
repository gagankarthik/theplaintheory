"use client";

import { useActionState } from "react";
import { setLeadStatus } from "@/app/admin/actions";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";
import type { LeadStatus } from "@/lib/types";

/** What staff can do from each status: the usual next step first. */
const NEXT: Record<LeadStatus, { status: LeadStatus; label: string; pending: string }[]> = {
  new: [
    { status: "open", label: "Mark as open", pending: "Opening" },
    { status: "closed", label: "Close request", pending: "Closing" },
  ],
  open: [{ status: "closed", label: "Close request", pending: "Closing" }],
  closed: [{ status: "open", label: "Reopen", pending: "Reopening" }],
};

function StatusButton({ leadId, status, label, pending, primary }: { leadId: string; status: LeadStatus; label: string; pending: string; primary: boolean }) {
  const toast = useToast();
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await setLeadStatus(prev, form);
    if (r?.ok) {
      toast(r.ok);
      return null;
    }
    return r;
  }, null);
  return (
    <form action={action} className="w-full sm:w-auto">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={primary ? "primary" : "ghost"} pending={pending} className="w-full max-sm:h-11 sm:w-auto">
        {label}
      </SubmitButton>
      {state?.error ? (
        <div className="mt-2 max-w-xs">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

/** Status changes for one request. Each is a zod-validated, permission-checked, audited server action. */
export function LeadStatusActions({ leadId, status }: { leadId: string; status: LeadStatus }) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
      {NEXT[status].map((n, i) => (
        <StatusButton key={n.status} leadId={leadId} status={n.status} label={n.label} pending={n.pending} primary={i === 0} />
      ))}
    </div>
  );
}
