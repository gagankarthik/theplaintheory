import { Skeleton, SkeletonHeader } from "@/components/app/ui/skeleton";

/** Shaped like a receipt: header, then the decision and integrity cards. */
export default function ReceiptLoading() {
  return (
    <div role="status" aria-label="Loading receipt" className="pb-10">
      <SkeletonHeader />
      {[6, 4, 5].map((rows, i) => (
        <div key={i} className="panel mb-6 space-y-4 p-6">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="grid gap-4 sm:grid-cols-[11rem_1fr]">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-full max-w-sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
