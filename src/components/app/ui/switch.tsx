"use client";

import { useId } from "react";

/**
 * On/off switch (role="switch"). The visible label names it; the description is linked with
 * aria-describedby. "On" is the lime track with the knob on the right; the track edge is the 3:1
 * boundary (soot when on), and the hit area is 40px tall.
 */
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
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "border-ink bg-selected dark:border-brand-solid dark:bg-brand-solid" : "border-boundary bg-surface"
        }`}
      >
        {/* on: lime track, the knob moves right and fills; off: a hollow track with a muted knob */}
        <span
          className={`inline-block size-4 rounded-full transition-transform duration-200 ease-out ${checked ? "translate-x-[22px] bg-ink dark:bg-soot" : "translate-x-[3px] bg-ink-3"}`}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
