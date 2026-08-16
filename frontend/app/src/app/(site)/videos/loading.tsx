import { VideoGridSkeleton } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function VideosLoading() {
  return (
    <div className="container-page pt-32">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-[45%]" />
      <div className="mt-8 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-14">
        <VideoGridSkeleton />
      </div>
    </div>
  );
}
