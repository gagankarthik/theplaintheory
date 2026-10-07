"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** a second, quieter line under the label */
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  id?: string;
  options: SelectOption<T>[];
  /** controlled value */
  value?: T;
  /** uncontrolled starting value */
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** posted with the form through a hidden input */
  name?: string;
  /** shown while nothing (or "") is chosen */
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** wider list than the trigger, e.g. "w-72" for options with descriptions */
  menuWidth?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Select-only combobox (WAI-ARIA APG): focus stays on the trigger and aria-activedescendant
 * points at the highlighted option. Arrow keys, Home/End, type-ahead, Enter/Space to pick,
 * Escape to close, Tab picks and moves on. The list is portalled and fixed-positioned, so
 * scrolling tables and overflow-hidden cards don't clip it; it flips up near the screen's end.
 */
export function Select<T extends string = string>({
  id,
  options,
  value: controlled,
  defaultValue,
  onValueChange,
  name,
  placeholder = "Choose",
  size = "md",
  disabled,
  required,
  className = "",
  menuWidth,
  ...aria
}: SelectProps<T>) {
  const autoId = useId();
  const triggerId = id ?? `sel-${autoId}`;
  const listId = `${triggerId}-list`;
  const [inner, setInner] = useState<T | undefined>(defaultValue);
  const value = controlled !== undefined ? controlled : inner;
  const selected = options.find((o) => o.value === value);
  // an empty-valued option labelled like the placeholder ("Choose") reads as not chosen yet
  const unset = !selected || (selected.value === "" && selected.label === placeholder);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; maxH: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // inside a modal <dialog> the list must render in the dialog (top layer), not behind it in <body>
  const [host, setHost] = useState<HTMLElement | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 220 && above > below;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, menuWidth ?? 0), up, maxH: Math.min(320, up ? above : below) });
  }, [menuWidth]);

  const show = (at?: number) => {
    if (disabled) return;
    const cur = options.findIndex((o) => o.value === value);
    setActive(at ?? (enabled(cur) ? cur : step(-1, 1)));
    setHost(trigger.current?.closest("dialog") ?? document.body);
    place();
    setOpen(true);
  };
  const hide = (focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  const pick = (i: number) => {
    if (!enabled(i)) return;
    const v = options[i].value;
    if (controlled === undefined) setInner(v);
    if (v !== value) onValueChange?.(v);
    hide();
  };

  // keep the list attached to its trigger while the page scrolls or resizes
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const typeahead = (key: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at > 700 ? key : typed.current.text + key, at: now };
    const q = typed.current.text.toLowerCase();
    const start = open ? active : options.findIndex((o) => o.value === value);
    const order = [...options.keys()].map((k) => (k + Math.max(start, 0) + (q.length === 1 ? 1 : 0)) % options.length);
    const hit = order.find((i) => enabled(i) && options[i].label.toLowerCase().startsWith(q));
    if (hit === undefined) return;
    if (open) setActive(hit);
    else pick(hit);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey) pick(active);
        else setActive((a) => step(a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(step(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(step(options.length, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
        e.preventDefault();
        hide();
        break;
      case "Tab":
        if (enabled(active)) {
          const v = options[active].value;
          if (controlled === undefined) setInner(v);
          if (v !== value) onValueChange?.(v);
        }
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key);
    }
  };

  const sm = size === "sm";
  return (
    <>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-required={required || undefined}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        disabled={disabled}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
        className={`group/sel flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-md)] border bg-surface text-left text-ink transition-[border-color,box-shadow] duration-150 focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--color-brand-wash)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-expanded:border-brand aria-expanded:shadow-[0_0_0_3px_var(--color-brand-wash)] aria-[invalid=true]:border-rose ${
          sm ? "h-9 px-2.5 text-xs max-sm:h-11" : "h-10 px-3 text-sm"
        } border-line-input hover:border-ink-3 ${className}`}
      >
        {selected?.icon ? <span className="shrink-0 text-ink-3">{selected.icon}</span> : null}
        <span className={`min-w-0 flex-1 truncate ${unset ? "text-ink-3" : ""}`}>{selected?.label ?? placeholder}</span>
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className={`shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="m4.5 6.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}

      {open && pos && host
        ? createPortal(
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-labelledby={aria["aria-labelledby"] ?? triggerId}
              tabIndex={-1}
              style={{ left: pos.left, top: pos.top, minWidth: pos.width, maxHeight: pos.maxH, transform: pos.up ? "translateY(-100%)" : undefined }}
              className="scroll-thin fixed z-[60] max-w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-[12px] border border-line bg-surface p-1 shadow-[0_12px_32px_-8px_rgb(11_16_32/0.18),0_2px_6px_rgb(11_16_32/0.06)] motion-safe:animate-[sel-in_140ms_ease-out]"
            >
              {options.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    onPointerMove={() => enabled(i) && active !== i && setActive(i)}
                    onClick={() => pick(i)}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-sm ${i === active ? "bg-paper" : ""} ${
                      o.disabled ? "cursor-not-allowed opacity-50" : ""
                    } ${sm ? "max-sm:min-h-11" : "min-h-9"}`}
                  >
                    {o.icon ? <span className="mt-0.5 shrink-0 text-ink-3">{o.icon}</span> : null}
                    <span className="min-w-0 flex-1">
                      <span className={`block ${isSel ? "font-medium text-ink" : "text-ink-2"}`}>{o.label}</span>
                      {o.description ? <span className="mt-0.5 block text-xs leading-snug text-ink-3">{o.description}</span> : null}
                    </span>
                    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className={`mt-0.5 shrink-0 text-brand ${isSel ? "" : "invisible"}`}>
                      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </li>
                );
              })}
            </ul>,
            host,
          )
        : null}
    </>
  );
}
