"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose, IconSearch } from "@/components/icons";

/** Below this width menus open as full-width bottom sheets. */
const PHONE = 640;
const GAP = 6;
const EDGE = 8;

/**
 * Menu-button pattern: click or Enter/Space/ArrowDown opens, focus moves to the first item (or the
 * search field), arrow keys move between items, Home/End jump, Escape closes and returns focus to the
 * trigger, clicking outside closes.
 *
 * The menu is portalled and fixed-positioned against the trigger, then clamped inside the viewport
 * (8px margin) and flipped above the trigger when there is more room there, so it never overflows the
 * screen or gets clipped by a scrolling parent. On phones (or always, with `sheet="always"`) it opens
 * as a full-width bottom sheet with a scrim and a focus trap.
 *
 * With `search`, a filter field sits on top and `children` receives the typed query (lower-cased).
 */
export function Dropdown({
  trigger,
  label,
  children,
  align = "left",
  side = "bottom",
  width = "w-72",
  triggerClassName = "",
  search,
  sheet = "phone",
  title,
}: {
  trigger: ReactNode;
  /** accessible name of the trigger and the menu */
  label: string;
  children: (close: () => void, query: string) => ReactNode;
  align?: "left" | "right";
  /** preferred side; the menu flips when the other side has more room */
  side?: "bottom" | "top";
  width?: string;
  triggerClassName?: string;
  /** show a filter field above the items */
  search?: { label: string; placeholder?: string };
  /** "phone" (default): a bottom sheet below 640px; "never": always a popover */
  sheet?: "phone" | "never";
  /** heading of the bottom sheet (defaults to `label`) */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [asSheet, setAsSheet] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean; maxH: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();

  const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  /** Item handlers close without moving focus: they navigate or submit. */
  const dismiss = useCallback(() => setOpen(false), []);
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (sheet === "phone" && vw < PHONE) {
      setAsSheet(true);
      return;
    }
    setAsSheet(false);
    const w = Math.min(panel.current?.offsetWidth ?? 288, vw - EDGE * 2);
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = side === "top" ? above >= 200 || above > below : below < 240 && above > below;
    const wanted = align === "right" ? r.right - w : r.left;
    const left = Math.max(EDGE, Math.min(wanted, vw - w - EDGE));
    setPos({ left, top: up ? r.top - GAP : r.bottom + GAP, up, maxH: Math.max(160, Math.min(480, up ? above : below)) });
  }, [align, side, sheet]);

  // Placed when opened (below); re-measured once the panel has its real width; follows scroll and resize.
  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    (field.current ?? items()[0])?.focus();
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // The sheet is modal: lock the page behind it.
  useEffect(() => {
    if (!open || !asSheet) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open, asSheet]);

  const show = () => {
    setQuery("");
    place();
    setOpen(true);
  };

  const onPanelKey = (e: KeyboardEvent) => {
    const list = items();
    const active = document.activeElement as HTMLElement;
    const i = list.indexOf(active);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i <= 0 && field.current) field.current.focus();
      else list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home" && active !== field.current) {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End" && active !== field.current) {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      if (!asSheet) {
        setOpen(false);
        return;
      }
      // focus trap inside the sheet
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>("button, a[href], input") ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  const body = (
    <>
      {search ? (
        <div className="relative px-1 pb-1 pt-0.5">
          <IconSearch size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={field}
            type="search"
            aria-label={search.label}
            placeholder={search.placeholder ?? "Search"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                items()[0]?.focus();
              }
            }}
            className="h-10 w-full rounded-full border border-boundary bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-2 focus:outline-offset-1 focus:outline-focus"
          />
        </div>
      ) : null}
      <div id={id} role="menu" aria-label={label}>
        {children(dismiss, query.trim().toLowerCase())}
      </div>
    </>
  );

  return (
    <div className="relative min-w-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            show();
          }
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open
        ? createPortal(
            asSheet ? (
              <div className="pt-app fixed inset-0 z-[70]">
                <div aria-hidden className="pt-fade absolute inset-0 bg-[rgb(15_15_15/0.5)]" />
                <div
                  ref={panel}
                  role="dialog"
                  aria-modal="true"
                  aria-label={title ?? label}
                  onKeyDown={onPanelKey}
                  className="pt-sheet-up scroll-thin absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-surface px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-ink shadow-[var(--shadow-float)]"
                >
                  <div className="mb-1 flex items-center justify-between gap-3 py-1 pl-3 pr-1">
                    <p className="text-base font-semibold">{title ?? label}</p>
                    <button type="button" onClick={() => close(true)} aria-label="Close" className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-raised hover:text-ink">
                      <IconClose size={18} />
                    </button>
                  </div>
                  {body}
                </div>
              </div>
            ) : (
              <div
                ref={panel}
                onKeyDown={onPanelKey}
                style={{
                  left: pos?.left ?? 0,
                  top: pos?.top ?? 0,
                  maxHeight: pos?.maxH,
                  transform: pos?.up ? "translateY(-100%)" : undefined,
                  visibility: pos ? undefined : "hidden",
                }}
                className={`pt-app pt-menu scroll-thin fixed z-[70] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-line-strong bg-surface p-1 text-ink shadow-[var(--shadow-float)] ${width}`}
              >
                {body}
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
}

/** Shared item styling for menu rows: 40px tall, the lime wash marks the checked one. */
export const menuItemClass =
  "flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink-2 outline-none transition-colors duration-150 hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-checked:bg-selected/45 aria-checked:font-medium aria-checked:text-ink dark:aria-checked:bg-selected";

/** Hairline between groups of menu items. */
export function MenuSeparator() {
  return <div role="separator" className="mx-1 my-1 h-px bg-line" />;
}

/** Small group label inside a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p role="presentation" className="eyebrow px-2.5 pb-1 pt-2">
      {children}
    </p>
  );
}
