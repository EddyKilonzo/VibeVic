"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Genre } from "@/data/types";
import * as taxonomy from "@/lib/taxonomy";

/**
 * The beat tree, fetched once on the server and shared with every client
 * component that needs to name a beat.
 *
 * ── Why a context and not a fetch per component ──────────────────────────
 * Naming a beat is a synchronous act. A story card renders "News · Kenya"
 * while it draws; so does an admin row, a filter chip, a footer column. If
 * each of those had to await the taxonomy, every one of them would need a
 * loading state for a string — and the page would flicker through a frame of
 * raw slugs on the way.
 *
 * The taxonomy is also small (twenty-one rows), changes rarely, and is needed
 * almost everywhere. That combination is exactly what a context is for: the
 * root layout fetches it once on the server, hands it across the client
 * boundary as a prop, and the helpers stay synchronous for everyone below.
 *
 * The functions are the same pure ones from `lib/taxonomy.ts`, pre-bound to
 * the list. Server components import those directly and pass their own data,
 * so there is one implementation and two ways of reaching it.
 */

export interface Taxonomy {
  /** Every beat, parents and children. Empty if the API could not be read. */
  genres: Genre[];
  /** The six top-level beats. */
  topBeats: Genre[];
  genreBySlug: (slug: string) => Genre | undefined;
  childBeats: (slug: string) => Genre[];
  genreFamily: (slug: string) => string[];
  parentBeat: (slug: string) => Genre | undefined;
  inGenre: (storySlug: string, filterSlug: string) => boolean;
  genreName: (slug: string) => string;
  genreLabel: (slug: string) => string;
}

/**
 * The default is an empty taxonomy, not a throw.
 *
 * A component rendered outside the provider — a test, a Storybook frame, an
 * error boundary that unmounted its ancestors — should draw with slugs where
 * names would be, not take the page down. `genreName` falls back to the slug
 * for precisely this reason.
 */
const TaxonomyContext = createContext<Taxonomy | null>(null);

function bind(genres: Genre[]): Taxonomy {
  return {
    genres,
    topBeats: taxonomy.topBeats(genres),
    genreBySlug: (slug) => taxonomy.genreBySlug(genres, slug),
    childBeats: (slug) => taxonomy.childBeats(genres, slug),
    genreFamily: (slug) => taxonomy.genreFamily(genres, slug),
    parentBeat: (slug) => taxonomy.parentBeat(genres, slug),
    inGenre: (storySlug, filterSlug) => taxonomy.inGenre(genres, storySlug, filterSlug),
    genreName: (slug) => taxonomy.genreName(genres, slug),
    genreLabel: (slug) => taxonomy.genreLabel(genres, slug),
  };
}

const EMPTY = bind([]);

export function TaxonomyProvider({
  genres,
  children,
}: {
  genres: Genre[];
  children: ReactNode;
}) {
  // Rebound only when the list itself changes, so the helper identities stay
  // stable across renders and nothing downstream re-runs an effect for them.
  const value = useMemo(() => bind(genres), [genres]);
  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy(): Taxonomy {
  return useContext(TaxonomyContext) ?? EMPTY;
}
