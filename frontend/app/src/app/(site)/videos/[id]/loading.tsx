import { MediaSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function VideoLoading() {
  return (
    <div role="status" aria-label="Loading report" className="container-page pt-28">
      <Skeleton className="h-3 w-28" />
      <div className="mt-6">
        <MediaSkeleton />
      </div>
      <Skeleton className="mt-8 h-8 w-[70%]" />
      <Skeleton className="mt-3 h-4 w-48" />
      <TextSkeleton lines={3} className="mt-8 max-w-[62ch]" />
    </div>
  );
}
