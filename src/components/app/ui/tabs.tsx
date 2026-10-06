"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** Arrow/Home/End move focus and selection (roving tabindex), per the WAI-ARIA authoring practices. */
function useRoving<T extends string>(items: TabItem<T>[], value: T, onChange: (v: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.value === value);
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % items.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };
  return { refs, onKeyDown };
}

/** Tab list. Pair each panel with <TabPanel> using the same idBase. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idBase,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  idBase: string;
}) {
  const { refs, onKeyDown } = useRoving(items, value, onChange);
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idBase}-tab-${t.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${idBase}-panel-${t.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`relative h-11 shrink-0 rounded-t-md px-3 text-sm font-bold transition-colors ${active ? "text-ink" : "text-ink-3 hover:bg-paper hover:text-ink"}`}
          >
            {t.label}
            <span aria-hidden className={`absolute inset-x-2 bottom-0 h-[2.5px] rounded-t-full bg-brand transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, value, children }: { idBase: string; value: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
      {children}
    </div>
  );
}

/** Segmented control: a radiogroup with roving focus. Used for date range, region, device, view toggles. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: TabItem<T>[];
  label: string;
  size?: "sm" | "md";
}) {
  const { refs, onKeyDown } = useRoving(options, value, onChange);
  const gid = useId();
  return (
    <div role="radiogroup" aria-label={label} id={gid} onKeyDown={onKeyDown} className="inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-paper p-0.5">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-[7px] font-bold transition-colors ${size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-xs"} ${
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(11_16_32/.14)]" : "text-ink-3 hover:bg-line hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
