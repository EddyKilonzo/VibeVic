import { Suspense } from "react";
import type { Metadata } from "next";
import Search from "@/views/Search";
import { StoryGridSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the reports and the written work.",
  // A results page keyed on a query string has nothing stable to index.
  robots: { index: false, follow: true },
};

export default function SearchRoute() {
  return (
    <Suspense fallback={<div className="container-page pt-32"><StoryGridSkeleton count={3} /></div>}>
      <Search />
    </Suspense>
  );
}
