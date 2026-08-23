import type { Metadata } from "next";
import Genres from "@/views/Genres";
import { TOP_BEATS } from "@/data/content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Beats",
  // Reads the real list rather than a hard-coded count. It said "the four
  // subjects" for a while after there were seven. The count is the top-level
  // beats: the subjects under them are the page's detail, not its shape.
  description: `The ${TOP_BEATS.length} subjects the work keeps returning to — reports and writing together.`,
  path: "/genres",
});

export default function GenresRoute() {
  return <Genres />;
}