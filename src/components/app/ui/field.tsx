import type { ComponentProps, ReactNode } from "react";
import { Select, type SelectProps } from "./select";

interface FieldBase {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** first error message for this field; wires aria-invalid + aria-describedby */
  error?: string | string[];
  /** visually hide the label but keep it for assistive tech */
  hideLabel?: boolean;
  className?: string;
  /** element rendered at the right of the label row (e.g. a counter) */
  aside?: ReactNode;
  /** extra classes for the control itself (className styles the wrapper) */
  controlClassName?: string;
}

const firstError = (e?: string | string[]) => (Array.isArray(e) ? e[0] : e);

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

function Frame({ id, label, hint, error, hideLabel, className, aside, children }: Omit<FieldBase, "error"> & { error?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <div className={`mb-1.5 flex items-baseline justify-between gap-3 ${hideLabel ? "sr-only" : ""}`}>
        <label htmlFor={id} className="label mb-0">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-rose">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const invalidRing = "!border-rose focus:!shadow-[0_0_0_4px_var(--color-rose-wash)]";

export function TextField({ id, label, hint, error, hideLabel, className, aside, controlClassName, ...input }: FieldBase & Omit<ComponentProps<"input">, "id">) {
  const err = firstError(error);
  return (
    <Frame id={id} label={label} hint={hint} error={err} hideLabel={hideLabel} className={className} aside={aside}>
      <input
        id={id}
        name={input.name ?? id}
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(id, hint, err)}
        {...input}
        className={`field ${err ? invalidRing : ""} ${controlClassName ?? ""}`}
      />
    </Frame>
  );
}

export function TextAreaField({ id, label, hint, error, hideLabel, className, aside, controlClassName, ...input }: FieldBase & Omit<ComponentProps<"textarea">, "id">) {
  const err = firstError(error);
  return (
    <Frame id={id} label={label} hint={hint} error={err} hideLabel={hideLabel} className={className} aside={aside}>
      <textarea
        id={id}
        name={input.name ?? id}
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(id, hint, err)}
        {...input}
        className={`field ${err ? invalidRing : ""} ${controlClassName ?? ""}`}
      />
    </Frame>
  );
}

export function SelectField<T extends string = string>({
  id,
  label,
  hint,
  error,
  hideLabel,
  className,
  aside,
  controlClassName,
  ...select
}: FieldBase & Omit<SelectProps<T>, "id" | "className">) {
  const err = firstError(error);
  return (
    <Frame id={id} label={label} hint={hint} error={err} hideLabel={hideLabel} className={className} aside={aside}>
      <Select<T> id={id} name={select.name ?? id} aria-invalid={err ? true : undefined} aria-describedby={describedBy(id, hint, err)} {...select} className={controlClassName} />
    </Frame>
  );
}
