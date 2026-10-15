import { Skeleton, SkeletonChart, SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/app/ui/skeleton";

/** Loading placeholders for the staff console, built from the kit's pieces in each page's real rhythm. */

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label} className="pb-10">
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Search field, a couple of selects and the count line. */
function FiltersSkeleton() {
  return (
    <div aria-hidden className="mb-3">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.6fr)_repeat(2,minmax(10rem,1fr))]">
        <Skeleton className="h-10 sm:col-span-2 lg:col-span-1" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="mt-4 h-3.5 w-40" />
    </div>
  );
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-[22px] w-16 !rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <Frame label="Loading platform overview">
      <SkeletonHeader actions={false} />
      <SkeletonStats />
      <SkeletonStats />
      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SkeletonChart height={240} />
        <CardSkeleton rows={4} />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </Frame>
  );
}

export function ListSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <SkeletonHeader actions={false} />
      <FiltersSkeleton />
      <SkeletonTable rows={10} cols={6} />
    </Frame>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <SkeletonHeader />
      <SkeletonStats />
      <div className="mb-6">
        <CardSkeleton rows={2} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </Frame>
  );
}
