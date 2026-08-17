import { Suspense } from "react";
import type { Metadata } from "next";
import Search from "@/views/Search";
import { StoryGridSkeleton } from "@/components/ui/Skeleton";
import { pageMetadata } from "@/lib/seo";

// A results page keyed on a query string has nothing stable to index, and
// letting a crawler enumerate them manufactures thousands of thin near
// duplicates competing with the articles they were meant to lead to.
export const metadata: Metadata = pageMetadata({
  title: "Search",
  description: "Search the reports and the written work.",
  path: "/search",
  index: false,
});

export default function SearchRoute() {
  return (
    <Suspense fallback={<div className="container-page pt-32"><StoryGridSkeleton count={3} /></div>}>
      <Search />
    </Suspense>
  );
}