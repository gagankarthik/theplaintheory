import type { ReactNode } from "react";
import { ButtonLink } from "./button";

/**
 * Cursor pagination for newest-first lists: "Showing …" on the left, "Newest" (back to the first
 * page, when not on it) and "Older" (when there's more) on the right.
 */
export function Pagination({
  showing,
  newestHref,
  olderHref,
  label = "Pages",
}: {
  /** what's on this page, e.g. "Showing 50 receipts, #1,201 to #1,250" */
  showing: ReactNode;
  /** link back to the first page; leave out on the first page */
  newestHref?: string | null;
  /** link to the next, older page; leave out when there's nothing older */
  olderHref?: string | null;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-ink-3">{showing}</p>
      {newestHref || olderHref ? (
        <div className="flex gap-2">
          {newestHref ? (
            <ButtonLink href={newestHref} variant="ghost" size="sm">
              Newest
            </ButtonLink>
          ) : null}
          {olderHref ? (
            <ButtonLink href={olderHref} variant="ghost" size="sm">
              Older <span aria-hidden>→</span>
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
