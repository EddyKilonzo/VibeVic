import { Suspense } from "react";
import type { Metadata } from "next";
import Stories from "@/views/Stories";
import { StoryGridSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Writing",
  description: "Written work, filterable by beat and by what you have saved.",
};

export default function StoriesRoute() {
  return (
    <Suspense fallback={<div className="container-page pt-32"><StoryGridSkeleton /></div>}>
      <Stories />
    </Suspense>
  );
}
