import type { ReactNode } from "react";

/** Empty screens invite the next action: what this place will hold, and the one thing to do first. */
export function EmptyState({ icon, title, children, action, headingLevel = 2 }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col items-start gap-1 rounded-[16px] border border-line bg-surface px-6 py-12 sm:items-center sm:text-center">
      {icon ? (
        <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-[14px] bg-brand-wash text-brand">
          {icon}
        </span>
      ) : null}
      <H className="text-base font-semibold">{title}</H>
      {children ? <div className="max-w-md text-sm leading-relaxed text-ink-3">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
