"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

type ServerAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * A button that opens a confirm dialog holding a server-action form. The dialog stays open with an
 * inline error (role="alert") when the action fails; on success it closes, focus returns to the
 * button, and a toast announces the result.
 */
export function ActionDialog({
  trigger,
  triggerVariant = "ghost",
  title,
  description,
  confirmLabel,
  pendingLabel,
  danger,
  action,
  hidden,
  disabled,
  disabledReason,
  children,
}: {
  trigger: ReactNode;
  triggerVariant?: ButtonVariant;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  action: ServerAction;
  hidden: Record<string, string>;
  disabled?: boolean;
  /** shown under the trigger when disabled, so the reason isn't hidden in a tooltip */
  disabledReason?: string;
  children?: (state: ActionResult) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await action(prev, form);
    if (r?.ok) {
      setOpen(false);
      toast(r.ok);
      return null;
    }
    return r;
  }, null);

  return (
    <div>
      <Button variant={triggerVariant} onClick={() => setOpen(true)} disabled={disabled} className="w-full sm:w-auto">
        {trigger}
      </Button>
      {disabled && disabledReason ? <p className="mt-1.5 max-w-xs text-xs text-ink-3">{disabledReason}</p> : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description} width={480}>
        <form action={formAction} noValidate className="space-y-4">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {children?.(state)}
          <FormMessage state={state} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} className="max-sm:h-11">
              Cancel
            </Button>
            <SubmitButton variant={danger ? "danger" : "primary"} pending={pendingLabel} className="max-sm:h-11">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
