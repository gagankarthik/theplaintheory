"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Menu-button pattern: click or Enter/Space opens, focus moves to the first item, arrow keys move
 * between items, Escape closes and returns focus to the trigger, clicking outside closes.
 */
export function Dropdown({
  trigger,
  label,
  children,
  align = "left",
  width = "w-72",
  triggerClassName = "",
}: {
  trigger: ReactNode;
  label: string;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  /** Item handlers close without moving focus: they navigate or submit. */
  const dismiss = () => setOpen(false);
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative min-w-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={`absolute top-full z-50 mt-2 max-h-[min(420px,70dvh)] overflow-auto rounded-[12px] bg-surface p-1.5 shadow-[0_0_0_1px_rgb(11_16_32/0.08),0_12px_32px_-8px_rgb(11_16_32/0.24)] ${width} ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(dismiss)}
        </div>
      ) : null}
    </div>
  );
}

/** Shared item styling for menu rows. */
export const menuItemClass =
  "flex min-h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm text-ink-2 outline-none transition-colors hover:bg-paper hover:text-ink focus-visible:bg-paper focus-visible:text-ink";
