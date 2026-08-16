import {
  AWARDS,
  GENRES,
  PUBLICATIONS,
  publishedStories,
  searchStories,
  storyBySlug,
  storiesByGenre,
  STORIES,
} from "./content";
import type { Award, Genre, Publication, Story } from "./types";

/**
 * The stand-in for the CMS API.
 *
 * Everything the pages read goes through these async functions rather than
 * touching the seed arrays directly. That is deliberate: it means the loading
 * and error states in the UI are real code paths exercised on every visit,
 * not decoration that would break the first time a network appeared. Wiring a
 * real backend is a change to this file alone.
 */

/** Simulated round-trip. Short enough to feel local, long enough to be seen. */
const LATENCY = 320;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const api = {
  stories: (): Promise<Story[]> => delay(publishedStories()),

  story: async (slug: string): Promise<Story> => {
    const story = await delay(storyBySlug(slug));
    if (!story || story.status !== "published") throw new Error("Story not found");
    return story;
  },

  byGenre: (slug: string): Promise<Story[]> => delay(storiesByGenre(slug)),

  search: (query: string): Promise<Story[]> => delay(searchStories(query), 180),

  genres: (): Promise<Genre[]> => delay(GENRES),

  publications: (): Promise<Publication[]> => delay(PUBLICATIONS),

  awards: (): Promise<Award[]> => delay(AWARDS),

  /** Admin: drafts and scheduled pieces included. */
  allStories: (): Promise<Story[]> =>
    delay(
      [...STORIES].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    ),
};
