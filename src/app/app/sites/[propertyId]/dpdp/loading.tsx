import { Skeleton, SkeletonHeader } from "@/components/app/ui/skeleton";

/** Shaped like the readiness page: summary card, then the checklist rows. */
export default function DpdpLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6 pb-10">
      <SkeletonHeader actions={false} />
      <div className="panel grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-2 w-full !rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="panel divide-y divide-line">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 px-5 py-4 sm:px-6">
            <Skeleton className="size-6 shrink-0 !rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
