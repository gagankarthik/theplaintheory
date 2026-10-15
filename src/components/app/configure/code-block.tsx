import { CopyButton } from "@/components/app/ui/copy-button";

/**
 * A copyable snippet: caption and Copy on a quiet strip, the code below in mono. The code scrolls
 * sideways on narrow screens and is focusable, so keyboard users can scroll it too.
 */
export function CodeBlock({ id, label, code }: { id: string; label: React.ReactNode; code: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-md border border-line bg-raised">
      <figcaption className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-1.5 pl-4 pr-2 text-xs text-ink-3">
        <span id={id} className="min-w-0 truncate">
          {label}
        </span>
        <CopyButton value={code} describedBy={id} size="md" />
      </figcaption>
      <pre className="scroll-thin overflow-x-auto p-4 font-mono text-xs leading-relaxed text-ink" tabIndex={0} role="region" aria-labelledby={id}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
