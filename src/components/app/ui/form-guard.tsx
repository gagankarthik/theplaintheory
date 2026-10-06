"use client";

import { useEffect, useId, type RefObject } from "react";
import { FORM_TOKEN_FIELD, HONEYPOT_FIELD } from "@/lib/form-guard-fields";

/**
 * Spam traps for public forms (see lib/form-guard.ts): an off-screen honeypot that people and
 * assistive tech never reach, plus the signed render timestamp when the form has one.
 */
export function FormGuard({ token }: { token?: string }) {
  const id = useId();
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0">
        <label htmlFor={`${id}-hp`}>Leave this field empty</label>
        <input id={`${id}-hp`} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {token ? <input type="hidden" name={FORM_TOKEN_FIELD} value={token} /> : null}
    </>
  );
}

/**
 * After a failed submit, move focus to the first invalid field (its label and error are announced
 * through aria-describedby), or to the form's error summary when no single field is at fault.
 */
export function useFocusOnError(state: { error?: string } | null | undefined, formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    if (!state?.error) return;
    const form = formRef.current;
    if (!form) return;
    const target = form.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form.querySelector<HTMLElement>("[data-form-summary]");
    target?.focus();
  }, [state, formRef]);
}
