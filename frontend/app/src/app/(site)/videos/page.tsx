import { Suspense } from "react";
import type { Metadata } from "next";
import Videos from "@/views/Videos";
import { VideoGridSkeleton } from "@/components/ui/Skeleton";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Reports",
  description:
    "Every published video report — campus systems, Kenyan culture and student life.",
  path: "/videos",
});

/**
 * The topic filter lives in the query string, so the grid reads
 * `useSearchParams` and has to sit behind Suspense. The fallback is the grid
 * skeleton, which means the filter never blanks the page.
 */
export default function VideosRoute() {
  return (
    <Suspense fallback={<div className="container-page pt-32"><VideoGridSkeleton /></div>}>
      <Videos />
    </Suspense>
  );
}