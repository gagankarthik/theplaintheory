"use client";

import { useId } from "react";

/** On/off switch (role="switch"). The visible label names it; the description is linked with aria-describedby. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
  /** include a hidden input so the switch participates in form posts */
  name?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">
          {label}
        </label>
        {description ? (
          <p id={`${id}-d`} className="mt-0.5 text-xs text-ink-3">
            {description}
          </p>
        ) : null}
      </div>
      {name ? <input type="hidden" name={name} value={checked ? "on" : ""} /> : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-jade" : "bg-ink-3"
        }`}
      >
        <span className={`inline-block size-[18px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[23px]" : "translate-x-[3px]"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
