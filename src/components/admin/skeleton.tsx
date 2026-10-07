/** Loading skeletons for the staff console, matching each page's real rhythm so nothing jumps. */

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="animate-pulse motion-reduce:animate-none">
        <div className="mb-8 py-8 sm:py-10">
          <div className="mb-3 h-8 w-56 rounded bg-line" />
          <div className="h-4 w-full max-w-md rounded bg-line" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function KpiSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line xl:grid-cols-4">
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="h-28 bg-surface p-5">
          <div className="h-3 w-24 rounded bg-line" />
          <div className="mt-3 h-7 w-16 rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="h-11 border-b border-line bg-paper" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
          <div className="h-4 w-1/3 rounded bg-line" />
          <div className="h-4 w-16 rounded bg-line" />
          <div className="ml-auto h-4 w-20 rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <Shell label="Loading platform overview">
      <KpiSkeleton tiles={8} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-80 rounded-lg border border-line bg-surface" />
        <div className="h-80 rounded-lg border border-line bg-surface" />
      </div>
    </Shell>
  );
}

export function ListSkeleton({ label }: { label: string }) {
  return (
    <Shell label={label}>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="h-11 w-full max-w-sm rounded-md bg-line" />
        <div className="h-11 w-36 rounded-md bg-line" />
      </div>
      <TableSkeleton />
    </Shell>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <Shell label={label}>
      <KpiSkeleton />
      <div className="mt-8 h-6 w-40 rounded bg-line" />
      <div className="mt-4">
        <TableSkeleton rows={4} />
      </div>
    </Shell>
  );
}
