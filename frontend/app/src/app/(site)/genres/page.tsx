import type { Metadata } from "next";
import Genres from "@/views/Genres";
import { getGenres, getStories } from "@/data/server";
import { topBeats } from "@/lib/taxonomy";
import { pageMetadata } from "@/lib/seo";

/**
 * Now `generateMetadata` rather than a static object, because the count in the
 * description is read from the archive and the archive is a fetch.
 *
 * The count has always been read rather than written — it said "the four
 * subjects" for a while after there were seven — and keeping that property is
 * the whole reason this became async instead of being hard-coded back.
 */
export async function generateMetadata(): Promise<Metadata> {
  const genres = await getGenres();
  const count = topBeats(genres).length;

  return pageMetadata({
    title: "Beats",
    description: `The ${count} subjects the work keeps returning to — reports and writing together.`,
    path: "/genres",
  });
}

export default async function GenresRoute() {
  const [genres, stories] = await Promise.all([getGenres(), getStories()]);
  return <Genres genres={genres} stories={stories} />;
}