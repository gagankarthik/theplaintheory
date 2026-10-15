import { Skeleton, SkeletonHeader } from "@/components/app/ui/skeleton";

/** Placeholder shaped like Billing: the plan and usage cards side by side, then the plans row. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="pb-10">
      <SkeletonHeader actions={false} />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 bg-surface p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="mt-4 h-10 w-full !rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
