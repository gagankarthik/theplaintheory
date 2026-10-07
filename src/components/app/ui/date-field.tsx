import type { ComponentProps, ReactNode } from "react";
import { TextField } from "./field";

/**
 * A day picker: the browser's own date input (keyboard and screen-reader support built in), styled
 * like TextField. Values are yyyy-mm-dd and always read as UTC days, which the label says.
 */
export function DateField({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | string[];
  className?: string;
  /** yyyy-mm-dd */
  defaultValue?: string;
  /** yyyy-mm-dd */
  min?: string;
  /** yyyy-mm-dd */
  max?: string;
} & Omit<ComponentProps<"input">, "id" | "type" | "className" | "defaultValue" | "min" | "max">) {
  return (
    <TextField
      id={id}
      type="date"
      label={
        <>
          {label} <span className="font-normal text-ink-3">(UTC)</span>
        </>
      }
      hint={hint}
      error={error}
      className={className}
      controlClassName="tabular-nums"
      {...input}
    />
  );
}
