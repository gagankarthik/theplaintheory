import { Skeleton, SkeletonHeader } from "@/components/app/ui/skeleton";

/** Placeholder shaped like a settings page: grouped sections with label/field rows. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="max-w-4xl pb-10">
      <SkeletonHeader actions={false} />
      {[3, 2].map((rows, i) => (
        <div key={i} className="mb-6 rounded-lg border border-line bg-surface">
          <div className="space-y-2 border-b border-line px-5 py-4 sm:px-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="divide-y divide-line px-5 sm:px-6">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="grid gap-3 py-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <Skeleton className="h-10 w-full max-w-xl !rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
