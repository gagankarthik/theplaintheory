"use client";

import { useId, useRef, useState } from "react";
import { IconClose } from "@/components/icons";

/**
 * Editable list of short values (e.g. personal data items). Enter or comma adds the typed value,
 * Backspace on an empty field removes the last chip, and every chip has a labelled remove button.
 * Changes are announced through a polite live region.
 */
export function ChipInput({
  id,
  label,
  hint,
  values,
  onChange,
  placeholder = "Type and press Enter",
  max = 15,
  maxLength = 80,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [announce, setAnnounce] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const full = values.length >= max;

  const add = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
    if (!v || full) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setAnnounce(`${v} is already listed.`);
      setText("");
      return;
    }
    onChange([...values, v]);
    setAnnounce(`Added ${v}.`);
    setText("");
  };
  const remove = (i: number) => {
    const v = values[i];
    onChange(values.filter((_, j) => j !== i));
    setAnnounce(`Removed ${v}.`);
    input.current?.focus();
  };

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--color-brand-wash)]"
        onClick={() => input.current?.focus()}
      >
        <ul className="flex flex-wrap gap-1.5 empty:hidden" aria-label={`${label}: ${values.length} item${values.length === 1 ? "" : "s"}`}>
          {values.map((v, i) => (
            <li key={v} className="inline-flex max-w-full items-center gap-1 rounded-full bg-line py-0.5 pl-2.5 pr-1 text-xs font-medium text-ink">
              <span className="truncate">{v}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="grid size-5 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-line-strong hover:text-ink"
                aria-label={`Remove ${v}`}
              >
                <IconClose size={12} />
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={input}
          id={id}
          value={text}
          disabled={disabled || full}
          maxLength={maxLength}
          aria-describedby={hint ? hintId : undefined}
          placeholder={full ? `Up to ${max} items` : values.length ? "" : placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) {
              v.split(",").slice(0, -1).forEach(add);
              setText(v.split(",").pop() ?? "");
            } else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && values.length) {
              remove(values.length - 1);
            }
          }}
          onBlur={() => add(text)}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-3"
        />
      </div>
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
