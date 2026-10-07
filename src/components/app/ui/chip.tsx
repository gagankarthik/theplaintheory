import type { ReactNode } from "react";

/**
 * A neutral reference tag in mono: a control or clause id such as "CC6.1" or "DPDP s.5". Never
 * coloured: it labels, it doesn't report a state (use Badge for that). `title` can spell it out.
 */
export function Chip({ children, title, className = "" }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-sm bg-paper px-1.5 py-0.5 font-mono text-2xs text-ink-2 ring-1 ring-inset ring-line ${className}`}>
      {children}
    </span>
  );
}
