/**
 * Loading placeholders shaped like the content they stand in for, so a page keeps its layout while
 * data streams in. Each loading.tsx composes these; they announce themselves once via the wrapper.
 */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={`skeleton block ${className}`} style={style} />;
}

/** The page header band: title and description lines, an action on the right. */
export function SkeletonHeader({ actions = true }: { actions?: boolean }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 pt-9">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
      {actions ? <Skeleton className="hidden h-9 w-32 sm:block" /> : null}
    </div>
  );
}

/** A divided row of KPI tiles. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 bg-surface px-5 py-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** A card holding a chart. */
export function SkeletonChart({ height = 260 }: { height?: number }) {
  return (
    <div className="panel p-5">
      <div className="mb-5 flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-36" />
      </div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {Array.from({ length: 28 }, (_, i) => (
          <Skeleton key={i} className="flex-1 !rounded-t-sm" style={{ height: `${30 + ((i * 37) % 60)}%` } } />
        ))}
      </div>
    </div>
  );
}

/** A table: header strip and rows. */
export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex gap-6 border-b border-line bg-raised px-5 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-6 px-5 py-3.5">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={`h-3.5 flex-1 ${c === 0 ? "max-w-[30%]" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Whole-page placeholder used by most dashboard loading.tsx files. */
export function SkeletonPage({ stats = true, chart = false, table = true }: { stats?: boolean; chart?: boolean; table?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className="pb-10">
      <SkeletonHeader />
      {stats ? <SkeletonStats /> : null}
      {chart ? (
        <div className="mb-6">
          <SkeletonChart />
        </div>
      ) : null}
      {table ? <SkeletonTable /> : null}
      <span className="sr-only">Loading</span>
    </div>
  );
}
