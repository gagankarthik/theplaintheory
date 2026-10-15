"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/app/ui/button";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

type ServerAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

interface ActionDialogProps {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  /** text that must be typed to enable the confirm button, e.g. the organization's name */
  typeToConfirm?: string;
  action: ServerAction;
  hidden: Record<string, string>;
  /** extra fields; receives the last result so fields can show their errors */
  children?: (state: ActionResult) => ReactNode;
}

/**
 * The ConfirmDialog behind every console action: a server-action form that stays open with an inline
 * error (role="alert") when the action fails, and on success closes and announces the result in a
 * toast. Controlled: the caller owns `open` (e.g. a row menu); see ActionDialog for a button.
 */
export function ActionConfirm({ open, onClose, title, description, confirmLabel, pendingLabel, danger, typeToConfirm, action, hidden, children }: ActionDialogProps & { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<ActionResult>(null);
  const toast = useToast();
  const close = () => {
    onClose();
    setState(null);
  };
  return (
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
  );
}

/**
 * A button that opens an ActionConfirm. Focus returns to the button when the dialog closes. When the
 * action isn't available the button is disabled and the reason is shown under it, not in a tooltip.
 */
export function ActionDialog({
  trigger,
  triggerVariant = "secondary",
  triggerSize = "md",
  disabled,
  disabledReason,
  ...props
}: ActionDialogProps & {
  trigger: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  disabled?: boolean;
  /** shown under the trigger when disabled */
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)} disabled={disabled} className="w-full sm:w-auto">
        {trigger}
      </Button>
      {disabled && disabledReason ? <p className="mt-1.5 max-w-xs text-xs text-ink-3">{disabledReason}</p> : null}
      <ActionConfirm open={open} onClose={() => setOpen(false)} {...props} />
    </div>
  );
}
