import type { Metadata } from "next";
import Genres from "@/views/Genres";
import { GENRES } from "@/data/content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Beats",
  // Reads the real list rather than a hard-coded count. It said "the four
  // subjects" for a while after there were seven.
  description: `The ${GENRES.length} subjects the work keeps returning to — reports and writing together.`,
  path: "/genres",
});

export default function GenresRoute() {
  return <Genres />;
}