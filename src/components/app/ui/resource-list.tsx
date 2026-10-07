import type { ReactNode } from "react";
import { Card, CardHeader } from "./card";

export interface ResourceRow {
  id: string;
  /** icon, avatar or date at the start of the row */
  leading?: ReactNode;
  title: ReactNode;
  /** one quiet line under the title */
  meta?: ReactNode;
  /** status and row actions at the end */
  trailing?: ReactNode;
}

/**
 * A short list of things inside a Card: invoices, API keys, sessions, webhooks. Rows are divided by
 * hairlines; on phones the trailing actions wrap under the title. With no rows the `empty` content
 * (usually an <EmptyState bare />) fills the card.
 */
export function ResourceList({
  rows,
  label,
  title,
  titleId,
  description,
  actions,
  empty,
  footer,
  className = "",
}: {
  rows: ResourceRow[];
  /** accessible name of the list, e.g. "Invoices, newest first" */
  label: string;
  title?: ReactNode;
  titleId?: string;
  description?: ReactNode;
  actions?: ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : label} className={className}>
      {title ? <CardHeader title={title} titleId={titleId} description={description} actions={actions} /> : null}
      {rows.length ? (
        <ul aria-label={label} className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:flex-nowrap sm:px-6">
              {r.leading ? <div className="shrink-0 text-sm text-ink-2">{r.leading}</div> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                {r.meta ? <div className="truncate text-xs text-ink-3">{r.meta}</div> : null}
              </div>
              {r.trailing ? <div className="flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-end">{r.trailing}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        (empty ?? <p className="px-5 py-8 text-center text-sm text-ink-3 sm:px-6">Nothing here yet.</p>)
      )}
      {footer ? <div className="rounded-b-lg border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">{footer}</div> : null}
    </Card>
  );
}
