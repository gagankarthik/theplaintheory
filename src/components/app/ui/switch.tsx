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
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">
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
        className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-jade-bright" : "bg-line-strong"
        }`}
      >
        <span className={`inline-block size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-[var(--ease-spring)] ${checked ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
