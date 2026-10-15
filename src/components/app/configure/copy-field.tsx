import { CopyButton } from "@/components/app/ui/copy-button";

/**
 * A labelled, read-only value people copy into their site: a site key, a config URL. The value is in
 * the data font, selectable, and wraps anywhere on phones; Copy (secondary, 40px) sits beside it on
 * wider screens and under it on phones.
 */
export function CopyField({ id, label, value, hint }: { id: string; label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className="label">
        {label}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <output
          id={id}
          aria-labelledby={`${id}-label`}
          className="flex min-h-10 min-w-0 flex-1 select-all items-center rounded-md border border-line bg-raised px-3 py-2 font-mono text-sm text-ink [overflow-wrap:anywhere]"
        >
          {value}
        </output>
        <div className="shrink-0">
          <CopyButton value={value} describedBy={`${id}-label`} size="md" />
        </div>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}
