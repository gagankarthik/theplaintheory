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
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-line px-3 pt-1.5">
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
            className={`relative h-11 shrink-0 rounded-t-[8px] px-3 text-sm transition-colors duration-150 focus-visible:-outline-offset-2 ${active ? "font-semibold text-ink" : "font-medium text-ink-3 hover:text-ink"}`}
          >
            {t.label}
            {/* active: semibold label plus the marker bar (soot in light, lime in dark) */}
            <span aria-hidden className={`absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-marker transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`} />
          </button>
        );
      })}
    </div>
  );
}

export interface StepItem<T extends string> extends TabItem<T> {
  /** finished steps get a tick */
  done?: boolean;
  /** something to fix on this step: "fail" (red) or "warn" (orange) */
  flag?: "fail" | "warn";
  /** screen-reader text for the flag, e.g. "1 failing check" */
  flagLabel?: string;
}

/**
 * A guided flow as a tab list: numbered steps joined by a line, the current one filled, finished
 * ones ticked in green, a red or orange dot where something needs fixing. Same keyboard model as
 * Tabs (arrows, Home, End). Only the current step shows its name, so it fits a narrow panel; the
 * others name themselves on hover and to screen readers.
 */
export function Steps<T extends string>({ items, value, onChange, label, idBase }: { items: StepItem<T>[]; value: T; onChange: (v: T) => void; label: string; idBase: string }) {
  const { refs, onKeyDown } = useRoving(items, value, onChange);
  const current = items.findIndex((t) => t.value === value);
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex items-center gap-1 border-b border-line px-4 py-3 sm:px-5">
      {items.map((t, i) => {
        const active = i === current;
        return (
          <div key={t.value} className={`flex items-center gap-1 ${active ? "min-w-0" : "shrink-0"} ${i > 0 ? "flex-1" : ""}`}>
            {i > 0 ? <span aria-hidden className={`h-px min-w-3 flex-1 ${i <= current ? "bg-ink-3" : "bg-line-strong"}`} /> : null}
            <button
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
              title={active ? undefined : t.title ?? (typeof t.label === "string" ? t.label : undefined)}
              className={`group/step flex h-10 items-center gap-2 rounded-full pr-2.5 pl-1 text-sm transition-colors duration-150 focus-visible:-outline-offset-2 ${active ? "bg-raised font-semibold text-ink" : "font-medium text-ink-3 hover:text-ink"}`}
            >
              <span
                aria-hidden
                className={`relative grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                  active ? "bg-inverse text-on-inverse" : t.done ? "bg-success-wash text-success" : "bg-surface text-ink-3 ring-1 ring-inset ring-line-strong"
                }`}
              >
                {t.done && !active ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                ) : (
                  i + 1
                )}
                {t.flag ? <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface ${t.flag === "fail" ? "bg-rose" : "bg-amber-bright"}`} /> : null}
              </span>
              <span className={active ? "whitespace-nowrap" : "sr-only"}>{t.label}</span>
              <span className="sr-only">
                {`, step ${i + 1} of ${items.length}`}
                {t.done ? ", done" : ""}
                {t.flagLabel ? `, ${t.flagLabel}` : ""}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, value, children }: { idBase: string; value: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
      {children}
    </div>
  );
}

/**
 * Segmented control: a radiogroup with roving focus. Used for date range, region, device, view toggles.
 * The chosen option is the lime "on" pill with a soot edge and a semibold label.
 */
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
    <div role="radiogroup" aria-label={label} id={gid} onKeyDown={onKeyDown} className="inline-flex max-w-full overflow-x-auto overflow-y-hidden rounded-full bg-paper p-[3px] ring-1 ring-inset ring-line-strong">
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
            className={`inline-flex min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-150 focus-visible:-outline-offset-2 ${size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-xs"} ${
              active ? "bg-selected font-semibold text-on-selected ring-1 ring-inset ring-ink dark:bg-brand-solid dark:text-soot dark:ring-0" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
