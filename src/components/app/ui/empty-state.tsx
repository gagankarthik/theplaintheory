import type { ReactNode } from "react";

/**
 * Empty screens invite the next action: what this place will hold, and the one thing to do first.
 * On its own it draws a card; `bare` drops the border for use inside a Card or ResourceList.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  headingLevel = 2,
  bare,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  bare?: boolean;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={`flex flex-col items-start gap-1 px-6 sm:items-center sm:text-center ${bare ? "py-10" : "rounded-lg border border-line bg-surface py-12"}`}>
      {icon ? (
        <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-md bg-brand-wash text-brand">
          {icon}
        </span>
      ) : null}
      <H className="text-base font-semibold">{title}</H>
      {children ? <div className="max-w-md text-sm leading-relaxed text-ink-3">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
