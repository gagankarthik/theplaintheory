import type { ReactNode } from "react";

/** Long-form reading styles for legal and guide content. Line length capped near 68 characters. */
export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`max-w-[68ch] text-[1.0625rem] leading-[1.7] text-ink-2 [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-brand [&_h2]:mt-16 [&_h2]:scroll-mt-28 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink first:[&_h2]:mt-0 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 ${className}`}
    >
      {children}
    </div>
  );
}
