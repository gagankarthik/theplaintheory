import { SkeletonOnboarding } from "@/components/app/ui/skeleton-auth";
import { Skeleton } from "@/components/app/ui/skeleton";

export default function Loading() {
  return (
    <div className="pt-app min-h-dvh bg-canvas text-ink">
      <div className="container-page flex h-16 items-center justify-between border-b border-line">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <SkeletonOnboarding />
    </div>
  );
}
