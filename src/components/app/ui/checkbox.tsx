import type { ComponentProps, ReactNode } from "react";

/**
 * A native checkbox, styled: the browser keeps keyboard, form posting and the checked state, and
 * the whole label is the click target (44px tall on phones). The description is linked with
 * aria-describedby. Checked boxes take the interactive fill (soot, lime in dark) with a contrasting
 * tick, so "checked" reads by shape as well as colour. Server-safe.
 */
export function Checkbox({
  id,
  label,
  description,
  className = "",
  ...input
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "id" | "type" | "className">) {
  return (
    <div className={`flex gap-3 ${description ? "items-start" : "min-h-10 items-center max-sm:min-h-11"} ${className}`}>
      <span className="relative grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          aria-describedby={description ? `${id}-d` : undefined}
          {...input}
          className="peer size-5 cursor-pointer appearance-none rounded-sm border border-boundary bg-surface transition-colors duration-150 checked:border-interactive checked:bg-interactive hover:border-ink checked:hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
        />
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" className="pointer-events-none absolute text-on-interactive opacity-0 peer-checked:opacity-100">
          <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {description ? (
          <span id={`${id}-d`} className="mt-0.5 block text-xs text-ink-3">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}
