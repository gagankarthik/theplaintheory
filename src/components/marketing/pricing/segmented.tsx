"use client";

import { useRef, type ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * Radio-group segmented control: one tab stop, arrow keys move and select (WAI-ARIA radio pattern).
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  tone = "light",
  size = "md",
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  tone?: "light" | "dark";
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.findIndex((o) => o.value === value);

  const move = (to: number) => {
    const i = (to + options.length) % options.length;
    onChange(options[i].value);
    refs.current[i]?.focus();
  };

  const dark = tone === "dark";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-full p-1 ${dark ? "bg-white/10 ring-1 ring-inset ring-white/20" : "bg-paper ring-1 ring-inset ring-line"}`}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(index + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(index - 1);
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full font-medium transition-colors ${size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-4 text-sm"} ${
              checked
                ? dark
                  ? "bg-white text-ink shadow-sm"
                  : "bg-white text-ink shadow-[0_1px_2px_rgb(11_16_32/0.08),0_0_0_1px_rgb(11_16_32/0.06)]"
                : dark
                  ? "text-white/80 hover:text-white"
                  : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
