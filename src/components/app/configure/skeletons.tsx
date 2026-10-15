import { Skeleton, SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/app/ui/skeleton";

/** Loading placeholders for the Configure pages, shaped like each page so nothing jumps when data arrives. */

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Loading" className="pb-10">
      {children}
      <span className="sr-only">Loading</span>
    </div>
  );
}

function CardBlock({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${className}`}>
      <div className="space-y-2 border-b border-line px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <div className="space-y-3 px-5 py-5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3.5 ${i % 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** Banner studio: the step panel beside the preview frame (stacked on phones). */
export function BannerStudioSkeleton() {
  return (
    <Wrap>
      <SkeletonHeader actions={false} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-surface">
          <div className="flex gap-4 border-b border-line px-4 py-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-3.5 flex-1" />
            ))}
          </div>
          <div className="space-y-4 px-5 py-5">
            <Skeleton className="h-3.5 w-3/4" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-72 max-w-full !rounded-full" />
          <Skeleton className="h-[480px] w-full sm:h-[600px]" />
        </div>
      </div>
    </Wrap>
  );
}

/** Regions: numbers, then four region cards in a grid. */
export function RegionsSkeleton() {
  return (
    <Wrap>
      <SkeletonHeader actions={false} />
      <SkeletonStats />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <CardBlock key={i} />
        ))}
      </div>
    </Wrap>
  );
}

/** Languages: numbers, the language table and the preview. */
export function LanguagesSkeleton() {
  return (
    <Wrap>
      <SkeletonHeader actions={false} />
      <SkeletonStats />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <SkeletonTable rows={8} cols={4} />
        <Skeleton className="h-[480px] w-full" />
      </div>
    </Wrap>
  );
}

/** Cookie catalog: numbers, tabs and filters, then the table. */
export function CatalogSkeleton() {
  return (
    <Wrap>
      <SkeletonHeader />
      <SkeletonStats />
      <div className="mb-3 flex gap-6 border-b border-line px-3 pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-44" />
      </div>
      <SkeletonTable rows={10} cols={6} />
    </Wrap>
  );
}

/** Scanner: the scan and its log beside the settings, then history. */
export function ScannerSkeleton() {
  return (
    <Wrap>
      <SkeletonHeader />
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="space-y-6">
          <CardBlock lines={3} />
          <CardBlock lines={5} />
        </div>
        <div className="space-y-6">
          <CardBlock lines={2} />
          <CardBlock lines={2} />
        </div>
      </div>
      <SkeletonTable rows={5} cols={6} />
    </Wrap>
  );
}

/** Install: numbers, then the step cards. */
export function InstallSkeleton() {
  return (
    <Wrap>
      <SkeletonHeader actions={false} />
      <SkeletonStats count={3} />
      <div className="max-w-4xl space-y-4">
        <CardBlock lines={5} />
        <CardBlock lines={3} />
        <CardBlock lines={2} />
      </div>
    </Wrap>
  );
}
