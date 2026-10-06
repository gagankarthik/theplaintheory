import type { ReactNode } from "react";

/** Empty screens invite the next action. The dashed edge echoes "held": nothing has run yet. */
export function EmptyState({ icon, title, children, action, headingLevel = 2 }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg border-[1.5px] border-dashed border-line-strong px-6 py-10 sm:items-center sm:text-center">
      {icon ? (
        <span aria-hidden className="mb-3 text-ink-3">
          {icon}
        </span>
      ) : null}
      <H className="text-lg font-bold">{title}</H>
      {children ? <div className="max-w-md text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
