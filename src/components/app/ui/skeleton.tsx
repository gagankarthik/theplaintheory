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
    <div className="mb-6 flex items-end justify-between gap-6 pt-6 sm:mb-8 sm:pt-8">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
      {actions ? <Skeleton className="hidden h-10 w-32 !rounded-full sm:block" /> : null}
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

/** Settings-style sections: a heading and label/field rows, then a save bar. */
export function SkeletonForm({ sections = 2, rows = 3 }: { sections?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="max-w-4xl space-y-6 pb-10">
      <SkeletonHeader actions={false} />
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} className="panel overflow-hidden">
          <div className="space-y-2 border-b border-line px-5 py-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <Skeleton className="h-10 w-full !rounded-md" />
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-line bg-raised px-5 py-3">
            <Skeleton className="h-9 w-20 !rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** A site's overview: the status card (preview and four facts), then the setup checklist. */
export function SkeletonSiteOverview() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6 pb-10">
      <SkeletonHeader />
      <div className="panel grid gap-6 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center">
        <Skeleton className="aspect-[4/3] w-full !rounded-lg" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
          <div className="col-span-2 flex gap-3 pt-1">
            <Skeleton className="h-9 w-28 !rounded-full" />
            <Skeleton className="h-9 w-20 !rounded-full" />
          </div>
        </div>
      </div>
      <div className="panel divide-y divide-line overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-7 shrink-0 !rounded-full" />
            <Skeleton className={`h-3.5 ${i === 0 ? "w-56" : "w-40"}`} />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Cards in a grid (evidence packs, webhook endpoints). */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="pb-10">
      <SkeletonHeader />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="panel space-y-3 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="mt-2 h-9 w-28 !rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
