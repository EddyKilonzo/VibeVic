import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function AdminStoriesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="ml-auto h-9 w-28 rounded-md" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm rounded-md" />
      <TableSkeleton />
    </div>
  );
}
