"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/**
 * Loading placeholders mirror the real layout rather than spinning, so the
 * page's structure is legible before its content arrives.
 */
export function StoryCardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="aspect-[16/10] w-full" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-[92%]" />
        <Skeleton className="h-5 w-[64%]" />
        <Skeleton className="mt-1 h-3 w-40" />
      </div>
    </div>
  );
}

export function StoryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading stories"
    >
      {Array.from({ length: count }, (_, i) => (
        <StoryCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div role="status" aria-label="Loading article">
      <div className="container-article pt-14">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-5 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-[70%]" />
        <Skeleton className="mt-7 h-4 w-56" />
      </div>
      <Skeleton className="mx-auto mt-10 aspect-[16/9] w-full max-w-[1100px]" />
      <div className="container-article mt-12 flex flex-col gap-3.5">
        {["w-full", "w-[97%]", "w-[88%]", "w-full", "w-[64%]"].map((w, i) => (
          <Skeleton key={i} className={cn("h-4", w)} />
        ))}
      </div>
    </div>
  );
}
