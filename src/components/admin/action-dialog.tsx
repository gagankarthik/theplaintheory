"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/app/ui/button";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

type ServerAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * A button that opens a ConfirmDialog holding a server-action form. The dialog stays open with an
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
  typeToConfirm,
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
  /** text that must be typed to enable the confirm button, e.g. the organization's name */
  typeToConfirm?: string;
  action: ServerAction;
  hidden: Record<string, string>;
  disabled?: boolean;
  /** shown under the trigger when disabled, so the reason isn't hidden in a tooltip */
  disabledReason?: string;
  /** extra fields; receives the last result so fields can show their errors */
  children?: (state: ActionResult) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult>(null);
  const toast = useToast();
  const close = () => {
    setOpen(false);
    setState(null);
  };

  return (
    <div>
      <Button variant={triggerVariant} onClick={() => setOpen(true)} disabled={disabled} className="w-full sm:w-auto">
        {trigger}
      </Button>
      {disabled && disabledReason ? <p className="mt-1.5 max-w-xs text-xs text-ink-3">{disabledReason}</p> : null}
      <ConfirmDialog
        open={open}
        onClose={close}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        destructive={danger}
        typeToConfirm={typeToConfirm}
        onConfirm={async (form) => {
          const r = await action(state, form);
          if (!r?.error && !r?.fieldErrors) {
            if (r?.ok) toast(r.ok);
            setState(null);
            return;
          }
          setState(r);
          return { error: r.error ?? "Fix the highlighted fields and try again." };
        }}
      >
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children?.(state)}
      </ConfirmDialog>
    </div>
  );
}
