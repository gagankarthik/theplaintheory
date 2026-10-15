"use client";

import Link from "next/link";
import { buttonClass } from "@/components/app/ui/button";
import { SelectField, TextField } from "@/components/app/ui/field";
import { IconClose } from "@/components/icons";

export interface ListFilter {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** the value that means "not filtered" (the first option by default) */
  allValue?: string;
}

export interface FilterChip {
  key: string;
  /** e.g. "Plan: Pro" */
  label: string;
  /** remove in place (client-side lists) */
  onRemove?: () => void;
  /** or a link to the same list without this filter (URL-driven lists) */
  href?: string;
}

const chipClass =
  "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-raised pl-3 pr-2 text-xs font-medium text-ink ring-1 ring-inset ring-line-strong transition-colors duration-150 hover:bg-line hover:ring-ink-3 max-sm:h-11";

/**
 * The applied filters as removable chips, the live result count and "Clear all". Every chip is a
 * single button (or link) whose name says what it removes, so it is one target, not a tiny "x".
 */
export function FilterChips({
  chips,
  summary,
  onClearAll,
  clearHref,
}: {
  chips: FilterChip[];
  /** "Showing 12 of 230 organizations" */
  summary: string;
  onClearAll?: () => void;
  clearHref?: string;
}) {
  return (
    <div className="mb-3 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
      <p aria-live="polite" className="text-sm tabular-nums text-ink-3">
        {summary}
      </p>
      {chips.length ? (
        <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const body = (
              <>
                <span className="truncate">{c.label}</span>
                <IconClose size={12} aria-hidden className="shrink-0 text-ink-3" />
              </>
            );
            return (
              <li key={c.key} className="max-w-full">
                {c.href ? (
                  <Link href={c.href} className={chipClass} aria-label={`Remove filter ${c.label}`}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" onClick={c.onRemove} className={chipClass} aria-label={`Remove filter ${c.label}`}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {chips.length ? (
        clearHref ? (
          <Link href={clearHref} className={buttonClass("link")}>
            Clear all
          </Link>
        ) : onClearAll ? (
          <button type="button" onClick={onClearAll} className={buttonClass("link")}>
            Clear all
          </button>
        ) : null
      ) : null}
    </div>
  );
}

/**
 * Top filter bar for the console's client-side lists: a search field and custom Selects that filter
 * as you type or pick, then the applied filters as chips with a live count and "Clear all".
 */
export function ListFilters({
  idBase,
  label,
  query,
  onQuery,
  searchLabel,
  placeholder,
  filters,
  count,
  total,
  noun,
}: {
  idBase: string;
  /** accessible name of the search region, e.g. "Filter organizations" */
  label: string;
  query: string;
  onQuery: (q: string) => void;
  searchLabel: string;
  placeholder: string;
  filters: ListFilter[];
  count: number;
  total: number;
  noun: [string, string];
}) {
  const unset = (f: ListFilter) => f.allValue ?? f.options[0]?.value;
  const chips: FilterChip[] = [
    ...(query.trim() ? [{ key: "q", label: `Search: “${query.trim()}”`, onRemove: () => onQuery("") }] : []),
    ...filters
      .filter((f) => f.value !== unset(f))
      .map((f) => ({ key: f.id, label: `${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`, onRemove: () => f.onChange(unset(f)) })),
  ];
  const word = (n: number) => (n === 1 ? noun[0] : noun[1]);
  const summary = chips.length ? `Showing ${count.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} ${word(total)}` : `${total.toLocaleString("en-GB")} ${word(total)}`;

  return (
    <>
      <div role="search" aria-label={label} className="mb-3 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.6fr)_repeat(auto-fit,minmax(10rem,1fr))]">
        <TextField
          id={`${idBase}-q`}
          type="search"
          label={searchLabel}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="sm:col-span-2 lg:col-span-1"
        />
        {filters.map((f) => (
          <SelectField key={f.id} id={`${idBase}-${f.id}`} label={f.label} value={f.value} onValueChange={f.onChange} options={f.options} />
        ))}
      </div>
      <FilterChips
        chips={chips}
        summary={summary}
        onClearAll={() => {
          onQuery("");
          for (const f of filters) f.onChange(unset(f));
        }}
      />
    </>
  );
}
