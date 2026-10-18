import { Skeleton, SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/app/ui/skeleton";

/** Shaped like the consent log: header, numbers, the filter row and the receipts table. */
export default function LogsLoading() {
  return (
    <div role="status" aria-label="Loading consent log" className="pb-10">
      <SkeletonHeader />
      <SkeletonStats />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full !rounded-md" />
          </div>
        ))}
      </div>
      <SkeletonTable rows={10} cols={7} />
    </div>
  );
}
