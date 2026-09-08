import { Skeleton, StoryGridSkeleton } from "@/components/ui/Skeleton";

/**
 * The archive's own skeleton, in a path-less group so that it is the archive's
 * alone. Sitting at `stories/` it was also a Suspense boundary above
 * `stories/[slug]`, which cost that route its 404 status — see
 * `(site)/(home)/loading.tsx` for what that broke and why it matters.
 */
export default function StoriesLoading() {
  return (
    <div className="container-page pt-32">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-[40%]" />
      <div className="mt-8 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-14">
        <StoryGridSkeleton />
      </div>
    </div>
  );
}
