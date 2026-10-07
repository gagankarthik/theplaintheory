"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { CopyButton } from "@/components/app/ui/copy-button";
import { IconCheck } from "@/components/icons";

/** Shared pieces of the public request forms: radio and checkbox groups, and the success panel. */

const firstError = (e?: string[]) => e?.[0];

const choiceClass =
  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-line-strong bg-white px-3 py-2.5 text-sm transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand";

/**
 * A group of radio or checkbox cards inside a fieldset with a legend. Errors are tied to every input
 * through aria-describedby, and the first input carries aria-invalid so focus-on-error lands on it.
 */
export function ChoiceGroup({
  name,
  legend,
  hint,
  type = "radio",
  options,
  defaultValue,
  error,
  columns = 2,
  required,
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  type?: "radio" | "checkbox";
  options: readonly { value: string; label: string; hint?: string }[];
  defaultValue?: string | string[];
  error?: string[];
  columns?: 1 | 2 | 3;
  required?: boolean;
}) {
  const err = firstError(error);
  const hintId = hint ? `${name}-hint` : null;
  const errId = err ? `${name}-error` : null;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const chosen = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  const grid = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 min-[420px]:grid-cols-2";
  return (
    <fieldset
      aria-describedby={describedBy}
      role={type === "radio" ? "radiogroup" : undefined}
      aria-required={type === "radio" && required ? true : undefined}
    >
      <legend className="label">
        {legend}
        {required ? null : <span className="font-normal text-ink-3"> (optional)</span>}
      </legend>
      {hint ? (
        <p id={hintId!} className="-mt-0.5 mb-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      <div className={`mt-1.5 grid gap-2 ${grid}`}>
        {options.map((o, i) => (
          <label key={o.value} className={choiceClass}>
            <input
              type={type}
              name={name}
              value={o.value}
              defaultChecked={chosen.includes(o.value)}
              aria-invalid={err && i === 0 ? true : undefined}
              aria-describedby={describedBy}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-ink)]"
            />
            <span className="min-w-0">
              <span className="block font-medium text-ink">{o.label}</span>
              {o.hint ? <span className="mt-0.5 block text-xs leading-snug text-ink-3">{o.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {err ? (
        <p id={errId!} className="mt-1.5 text-xs font-bold text-rose">
          {err}
        </p>
      ) : null}
    </fieldset>
  );
}

/** "(optional)" marker for field labels. */
export const Optional = () => <span className="font-normal text-ink-3"> (optional)</span>;

/**
 * Confirmation after a request is stored: the reference to quote, where the reply goes, and what
 * happens next. Focus moves to the heading so screen-reader users hear the result.
 */
export function RequestSuccess({ message, reference, email, next }: { message: string; reference?: string; email?: string; next: string[] }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div role="status" className="flex flex-col items-start gap-5 py-2">
      <span className="grid size-11 place-items-center rounded-full bg-jade-wash text-jade" aria-hidden>
        <IconCheck size={22} />
      </span>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          Request received
        </h2>
        <p className="mt-2 text-[15px] text-ink-2">{message}</p>
      </div>
      {reference ? (
        <div className="w-full rounded-[var(--radius-lg)] bg-paper p-4 ring-1 ring-inset ring-line">
          <p id="request-ref-label" className="text-xs text-ink-3">
            Your reference
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-lg font-semibold tracking-wide text-ink">{reference}</span>
            <CopyButton value={reference} label="Copy reference" describedBy="request-ref-label" />
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Quote it if you write to us about this request{email ? <>. Our reply goes to <span className="font-medium text-ink-2">{email}</span></> : null}.
          </p>
        </div>
      ) : null}
      <div className="w-full">
        <h3 className="text-sm font-semibold">What happens next</h3>
        <ol className="mt-3 space-y-3">
          {next.map((step, i) => (
            <li key={step} className="flex gap-3 text-[15px] text-ink-2">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-wash text-xs font-semibold text-brand-ink">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <Link href="/contact" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
        Back to all contact options
      </Link>
    </div>
  );
}

/** The privacy line under every request form. */
export function PrivacyNote() {
  return (
    <p className="text-xs leading-relaxed text-ink-3">
      We use these details only to handle your request. See our{" "}
      <a href="/legal/privacy" className="underline underline-offset-2 hover:text-ink">
        privacy notice
      </a>
      .
    </p>
  );
}
