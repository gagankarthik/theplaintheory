"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown } from "@/components/icons";
import { CURRENCIES, currencyInfo, type Currency } from "@/lib/plans";

/**
 * Currency dropdown (WAI-ARIA select-only combobox): the button shows the current currency; the list
 * opens on click, Enter, Space or the arrow keys; arrows/Home/End move, Enter or Space picks, Escape
 * or Tab closes, and typing a letter jumps to the matching code. Used on the marketing site and in
 * the dashboard so both read the same.
 */
export function CurrencySelect({
  value,
  onChange,
  tone = "light",
  size = "md",
  label = "Currency",
}: {
  value: Currency;
  onChange: (c: Currency) => void;
  tone?: "light" | "dark";
  size?: "sm" | "md";
  label?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = currencyInfo(value);
  const dark = tone === "dark";

  // Close on outside pointer down.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !listRef.current?.contains(t))
        setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // The list is portalled to <body> so a clipping parent (e.g. a hero with overflow hidden) can't cut it
  // off; it follows the button while open.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(CURRENCIES[i].id);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const selectedIndex = CURRENCIES.findIndex((c) => c.id === value);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = CURRENCIES.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openAt(selectedIndex);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (/^[a-z]$/i.test(e.key)) {
          const i = CURRENCIES.findIndex((c) =>
            c.code.startsWith(e.key.toUpperCase()),
          );
          if (i >= 0) setActive(i);
        }
    }
  };

  const h = size === "sm" ? "h-8 text-[13px]" : "h-[44px] text-sm";

  return (
    <div ref={rootRef} className="relative inline-block">
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center gap-2 rounded-full pl-4 pr-3 font-medium transition-colors ${h} ${
          dark
            ? "bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15"
            : "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:ring-ink/30"
        }`}
      >
        <span id={`${id}-value`}>
          <span aria-hidden className={dark ? "text-white/70" : "text-ink-3"}>
            {current.symbol}
          </span>{" "}
          {current.code}
        </span>
        <IconChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${dark ? "text-white/70" : "text-ink-3"}`}
        />
      </button>

      {open && pos
        ? createPortal(
            <ul
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={`${id}-label`}
              style={{ top: pos.top, left: pos.left }}
              className="pt-menu fixed z-[60] w-60 -translate-x-1/2 rounded-[14px] bg-white p-1.5 text-left text-ink shadow-[0_2px_4px_rgba(11,16,32,0.06),0_24px_48px_-16px_rgba(11,16,32,0.3)] ring-1 ring-ink/[0.08]"
            >
              {CURRENCIES.map((c, i) => {
                const selected = c.id === value;
                return (
                  <li
                    key={c.id}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={selected}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 ${i === active ? "bg-paper" : ""}`}
                  >
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-paper text-[13px] font-semibold text-ink-2 ring-1 ring-inset ring-line"
                    >
                      {c.symbol}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {c.code}
                      </span>
                      <span className="block text-xs text-ink-3">{c.name}</span>
                    </span>
                    {selected ? (
                      <IconCheck size={16} className="text-brand" />
                    ) : null}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
