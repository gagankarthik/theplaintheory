import type { ChangeEvent, ReactNode } from "react";

export interface RadioCardOption<T extends string = string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  /** e.g. <Badge tone="brand">Recommended</Badge> */
  badge?: ReactNode;
  disabled?: boolean;
}

/**
 * Large radio choices in a fieldset: plan, layout, region. Built on native radios sharing a name,
 * so arrow keys move between choices, Space picks, the group is one tab stop and the value posts
 * with the form. The chosen card gets an ultramarine edge. Works controlled (value + onValueChange)
 * or uncontrolled (defaultValue).
 */
export function RadioCardGroup<T extends string = string>({
  name,
  legend,
  hideLegend,
  description,
  options,
  value,
  defaultValue,
  onValueChange,
  columns = 2,
  className = "",
}: {
  name: string;
  legend: ReactNode;
  hideLegend?: boolean;
  description?: ReactNode;
  options: RadioCardOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols = columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "";
  const descId = description ? `${name}-desc` : undefined;
  const controlled = value !== undefined;
  return (
    <fieldset className={className} aria-describedby={descId}>
      <legend className={hideLegend ? "sr-only" : "label"}>{legend}</legend>
      {description ? (
        <p id={descId} className="-mt-0.5 mb-3 text-sm text-ink-3">
          {description}
        </p>
      ) : null}
      <div className={`grid gap-3 ${cols}`}>
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className="relative flex cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-surface p-4 transition-colors hover:border-ink-3 has-checked:border-brand has-checked:bg-brand-wash/40 has-checked:ring-1 has-checked:ring-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-disabled:cursor-not-allowed has-disabled:opacity-50"
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                disabled={o.disabled}
                {...(controlled ? { checked: value === o.value, onChange: (e: ChangeEvent<HTMLInputElement>) => e.target.checked && onValueChange?.(o.value) } : { defaultChecked: defaultValue === o.value, onChange: onValueChange ? () => onValueChange(o.value) : undefined })}
                aria-labelledby={`${id}-t`}
                aria-describedby={o.description ? `${id}-d` : undefined}
                className="peer mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-line-input bg-surface checked:border-4 checked:border-brand focus-visible:outline-none"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span id={`${id}-t`} className="text-sm font-semibold text-ink">
                    {o.title}
                  </span>
                  {o.badge}
                </span>
                {o.description ? (
                  <span id={`${id}-d`} className="mt-0.5 block text-sm text-ink-3">
                    {o.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
