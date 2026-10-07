import type { ReactNode } from "react";

/**
 * A titled block of a page that isn't itself a card, e.g. a table with its toolbar. The h2 matches
 * CardHeader's (text-base, semibold); the header always sits 16px above the content. Stack sections
 * with `space-y-8` on the parent.
 */
export function PageSection({
  id,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  /** used for the heading id (`${id}-h`) and as the section's anchor */
  id: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-20 ${className}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description ? <div className="mt-0.5 max-w-prose text-sm text-ink-3">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
