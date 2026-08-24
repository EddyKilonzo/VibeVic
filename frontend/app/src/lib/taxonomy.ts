import type { Genre, Story, StorySummary } from "@/data/types";

/**
 * The beat tree and the archive, as pure functions over data passed in.
 *
 * These used to live in `data/content.ts` and close over the bundled `GENRES`
 * and `STORIES` arrays. That is what made the taxonomy static: `genreLabel`
 * could be called from anywhere precisely because the answer was compiled in.
 *
 * Now the answer comes from the database, so the data has to arrive as an
 * argument. Server code passes what it fetched; client components get the
 * same functions pre-bound to the genre list through `useTaxonomy()`. The
 * logic itself is unchanged and lives in exactly one place, which is the point
 * — a second copy of "does this story belong to this beat" would be a second
 * copy that can disagree.
 *
 * Everything here is structurally typed rather than tied to `Story`, so a
 * summary from a listing works wherever a full article would.
 */

/* ── Beats ─────────────────────────────────────────────────────────────── */

export function genreBySlug(genres: Genre[], slug: string): Genre | undefined {
  return genres.find((genre) => genre.slug === slug);
}

/** The six top-level beats, in the order the archive lists them. */
export function topBeats(genres: Genre[]): Genre[] {
  return genres.filter((genre) => !genre.parent);
}

/** The beats filed directly under this one. Empty for a child, and for a leaf parent. */
export function childBeats(genres: Genre[], slug: string): Genre[] {
  return genres.filter((genre) => genre.parent === slug);
}

/**
 * A slug and everything under it.
 *
 * The reason every count and filter goes through this: a story about Kenyan
 * politics is filed `news-kenya`, so a `News` section that matched on the slug
 * alone would report zero pieces while sitting directly above them. Called
 * with a child, it is just that child — nothing inherits upwards.
 */
export function genreFamily(genres: Genre[], slug: string): string[] {
  return [slug, ...childBeats(genres, slug).map((genre) => genre.slug)];
}

/** The parent beat of a child slug, or undefined for a top-level one. */
export function parentBeat(genres: Genre[], slug: string): Genre | undefined {
  const parent = genreBySlug(genres, slug)?.parent;
  return parent ? genreBySlug(genres, parent) : undefined;
}

/** True when `storySlug` belongs to `filterSlug` — itself or one of its children. */
export function inGenre(genres: Genre[], storySlug: string, filterSlug: string): boolean {
  return storySlug === filterSlug || genreBySlug(genres, storySlug)?.parent === filterSlug;
}

/**
 * The beat's own name.
 *
 * Falls back to the slug when the taxonomy has not loaded or does not know it.
 * A slug is ugly but it is true; a blank space where a beat should be reads as
 * a broken page, and an invented name would be worse than both.
 */
export function genreName(genres: Genre[], slug: string): string {
  return genreBySlug(genres, slug)?.name ?? slug;
}

/**
 * "News · Kenya" — the child under the beat it belongs to.
 *
 * For anywhere a beat is named out of context (a story card, an admin row),
 * where "Kenya" alone does not say which half of the archive it is from.
 */
export function genreLabel(genres: Genre[], slug: string): string {
  const parent = parentBeat(genres, slug);
  return parent ? `${parent.name} · ${genreName(genres, slug)}` : genreName(genres, slug);
}

/* ── Stories ───────────────────────────────────────────────────────────── */

type Listable = Pick<StorySummary, "status" | "publishedAt" | "genre">;

/**
 * Published work, newest first.
 *
 * The API's public routes already filter to published pieces, so on a server
 * read this is a no-op guard. It stays because the admin list contains drafts
 * and the same components render both.
 */
export function publishedStories<T extends Listable>(stories: T[]): T[] {
  return stories
    .filter((story) => story.status === "published")
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

export function featuredStories<T extends Listable & { featured?: boolean }>(
  stories: T[],
): T[] {
  return publishedStories(stories).filter((story) => story.featured);
}

/** Everything under a beat, including the subjects beneath it. */
export function storiesByGenre<T extends Listable>(
  genres: Genre[],
  stories: T[],
  slug: string,
): T[] {
  return publishedStories(stories).filter((story) => inGenre(genres, story.genre, slug));
}

/**
 * What to read next.
 *
 * ── Why this is not "same beat first" ────────────────────────────────────
 * It used to partition the archive into same-genre and everything-else, then
 * take the first three in publication order. With five pieces across seven
 * beats that is close to a random three: four of the seven hold exactly one
 * story, so the same-genre bucket is usually empty and the result is just "the
 * three most recent", which the site already shows on every other page.
 *
 * Tags are the finer signal. Two pieces sharing "mental health" belong
 * together whether one is filed under Science and the other under Lifestyle —
 * and that cross-beat pairing is the one a reader could not have found on
 * their own, which is the only thing a related rail is for.
 *
 * Scoring, not bucketing: a shared tag is worth more than a shared beat,
 * because a beat is one of seven and a tag is specific. Recency breaks ties so
 * an unrelated filler slot is at least the newest thing available, and stories
 * with nothing in common are still returned rather than leaving a short rail —
 * three cards is the layout, and two is a gap.
 */
export function relatedStories<T extends Listable & { id: string; tags: string[] }>(
  stories: T[],
  story: Pick<Story, "id" | "tags" | "genre">,
  limit = 3,
): T[] {
  const tags = new Set(story.tags.map((tag) => tag.toLowerCase()));

  return publishedStories(stories)
    .filter((candidate) => candidate.id !== story.id)
    .map((candidate) => {
      const shared = candidate.tags.filter((tag) => tags.has(tag.toLowerCase())).length;
      return {
        story: candidate,
        score: shared * 10 + (candidate.genre === story.genre ? 1 : 0),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        +new Date(b.story.publishedAt) - +new Date(a.story.publishedAt),
    )
    .slice(0, limit)
    .map((scored) => scored.story);
}
