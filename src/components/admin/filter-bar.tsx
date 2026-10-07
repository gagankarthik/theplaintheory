"use client";

import type { ReactNode } from "react";

/** Search box plus filters, with a polite live count so screen-reader users hear the result change. */
export function FilterBar({
  idBase,
  query,
  onQuery,
  placeholder,
  searchLabel,
  children,
  count,
  total,
  noun,
  onReset,
}: {
  idBase: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  searchLabel: string;
  children?: ReactNode;
  count: number;
  total: number;
  noun: [string, string];
  onReset?: () => void;
}) {
  const filtered = count !== total;
  return (
    <div className="mb-4">
      <div role="search" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 sm:w-80">
          <label htmlFor={`${idBase}-q`} className="label">
            {searchLabel}
          </label>
          <input id={`${idBase}-q`} type="search" className="field max-sm:h-11" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
        </div>
        {children}
        {filtered && onReset ? (
          <button type="button" onClick={onReset} className="btn btn-ghost max-sm:h-11 sm:mb-0">
            Clear filters
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-ink-3">
        {filtered ? `Showing ${count} of ${total} ${total === 1 ? noun[0] : noun[1]}` : `${total} ${total === 1 ? noun[0] : noun[1]}`}
      </p>
    </div>
  );
}

export function FilterSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="field w-full max-sm:h-11 sm:w-auto sm:min-w-36" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
