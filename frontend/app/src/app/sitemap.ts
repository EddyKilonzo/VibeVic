import type { MetadataRoute } from "next";
import { getGenres, getStories } from "@/data/server";
import { inGenre, storiesByGenre } from "@/lib/taxonomy";
import { VIDEOS, videoBeat } from "@/data/videos";
import { SITE_URL } from "@/lib/site";

/**
 * The sitemap, built from the archive rather than maintained by hand.
 *
 * ── What is in it ────────────────────────────────────────────────────────
 * The pages a stranger could usefully arrive on: the home page, the two
 * archives, the biography, contact, every published story and every report,
 * and the beat pages that actually have work filed under them.
 *
 * ── What is not, and why ─────────────────────────────────────────────────
 * The newsroom and its sign-in page, because they are private. Internal
 * search, because it is an unbounded space of query permutations rather than
 * a set of pages. And an empty beat: a listing page with nothing on it is a
 * thin page, and asking a crawler to fetch one is asking it to conclude the
 * site has thin pages.
 *
 * ── lastModified ─────────────────────────────────────────────────────────
 * Only set where a real date exists. Stamping `new Date()` on every entry at
 * build time would tell a crawler the entire site changed every deploy, which
 * is both false and self-defeating: a feed that cries change constantly stops
 * being a signal about anything.
 *
 * ── When the API cannot be reached ───────────────────────────────────────
 * The fetches degrade to empty and this emits the six static pages alone. A
 * short sitemap is recoverable — the next revalidation fills it back in. A
 * build that died here would take the whole deploy with it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [genres, stories] = await Promise.all([getGenres(), getStories()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/stories`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/videos`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/genres`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ];

  const storyPages: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${SITE_URL}/stories/${story.slug}`,
    // The piece's own dates, never the build's.
    lastModified: new Date(story.updatedAt || story.publishedAt),
    changeFrequency: "yearly",
    priority: 0.8,
  }));

  const videoPages: MetadataRoute.Sitemap = VIDEOS.map((video) => ({
    url: `${SITE_URL}/videos/${video.id}`,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  /*
   * A beat earns a URL by having work on it, not by existing in a list.
   *
   * These used to be `/genres#slug`, which is not an address: a crawler drops
   * the fragment, so twenty-one entries collapsed into one page and no
   * subject had a URL that could rank for it. Each beat has a real page now.
   */
  const beatPages: MetadataRoute.Sitemap = genres
    .filter(
      (genre) =>
        storiesByGenre(genres, stories, genre.slug).length > 0 ||
        VIDEOS.some((video) => inGenre(genres, videoBeat(video), genre.slug)),
    )
    .map((genre) => ({
      url: `${SITE_URL}/beats/${genre.slug}`,
      changeFrequency: "monthly",
      // Parents gather a whole family and are the pages worth surfacing first.
      priority: genre.parent ? 0.5 : 0.6,
    }));

  return [...staticPages, ...storyPages, ...videoPages, ...beatPages];
}
