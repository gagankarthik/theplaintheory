"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { IconAlert } from "@/components/icons";
import { Button } from "./button";
import { Dialog } from "./dialog";

/** What onConfirm returns: nothing on success (the dialog closes), or an object to stay open. */
export type ConfirmResult = void | undefined | { error?: string };

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** shown on the confirm button while onConfirm runs, e.g. "Removing" */
  pendingLabel?: string;
  /** rose confirm button, for actions that delete or can't be undone */
  destructive?: boolean;
  /** the exact text the person must type before the confirm button is enabled, e.g. a domain */
  typeToConfirm?: string;
  /**
   * Runs on confirm with the form's data (hidden inputs and any fields passed as children). Resolve
   * with nothing to close the dialog; resolve with { error } to keep it open and show the error.
   */
  onConfirm: (form: FormData) => Promise<ConfirmResult>;
  /** extra fields or hidden inputs, rendered inside the form above the buttons */
  children?: ReactNode;
  width?: number;
}

/**
 * Confirmation for consequential actions, on the native-<dialog> Dialog. The confirm button shows a
 * pending state while onConfirm runs; a failure keeps the dialog open with the error inline
 * (role="alert"). With `typeToConfirm`, confirming needs the exact text typed first.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title} description={props.description} width={props.width ?? 480}>
      {/* mounted only while open, so the typed text and the error reset each time */}
      <ConfirmBody {...props} />
    </Dialog>
  );
}

function ConfirmBody({ onClose, confirmLabel, pendingLabel, destructive, typeToConfirm, onConfirm, children }: ConfirmDialogProps) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const locked = Boolean(typeToConfirm) && typed.trim() !== typeToConfirm;

  // onSubmit rather than a form action, so fields keep what was typed when the action fails
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked || pending) return;
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        const r = await onConfirm(form);
        if (r && typeof r === "object") {
          if (r.error) setError(r.error);
          return;
        }
        onClose();
      } catch (e) {
        // let Next's redirect()/notFound() control-flow errors through
        if (e && typeof e === "object" && "digest" in e) throw e;
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={pending || undefined}>
      {children}
      {typeToConfirm ? (
        <div>
          <label htmlFor={`${id}-type`} className="label">
            Type <code className="rounded-sm bg-paper px-1 py-0.5 font-mono text-ink ring-1 ring-inset ring-line">{typeToConfirm}</code> to confirm
          </label>
          <input
            id={`${id}-type`}
            className="field font-mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={`${id}-type-hint`}
          />
          <p id={`${id}-type-hint`} className="mt-1.5 text-xs text-ink-3">
            {confirmLabel} turns on once this matches exactly.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-rose-wash px-3 py-2.5 text-sm text-rose">
          <IconAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} className="max-sm:h-11">
          Cancel
        </Button>
        <Button type="submit" variant={destructive ? "danger" : "primary"} loading={pending} loadingLabel={pendingLabel} disabled={locked} className="max-sm:h-11">
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
