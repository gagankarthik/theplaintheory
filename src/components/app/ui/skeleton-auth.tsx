import { Skeleton } from "./skeleton";

/** A sign-in or sign-up form while its page loads: heading, fields, the primary button. */
export function SkeletonAuthForm({ fields = 2 }: { fields?: number }) {
  return (
    <div role="status" aria-label="Loading" className="w-full">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      <div className="mt-8 space-y-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-11 w-full !rounded-md" />
          </div>
        ))}
        <Skeleton className="h-11 w-full !rounded-full" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Onboarding while it loads: the step rail and the first step's two choice cards. */
export function SkeletonOnboarding() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton className="size-7 shrink-0 !rounded-full" />
            <Skeleton className="hidden h-3 w-20 sm:block" />
          </div>
        ))}
      </div>
      <div className="panel mt-8 p-6 sm:p-8">
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40 w-full !rounded-lg" />
          <Skeleton className="h-40 w-full !rounded-lg" />
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
