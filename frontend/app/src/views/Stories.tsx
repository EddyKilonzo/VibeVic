"use client";

import { useMemo, useState } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark } from "lucide-react";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { api } from "@/data/api";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { useAsync } from "@/hooks/useAsync";
import { useBookmarks } from "@/context/BookmarksProvider";
import { StoryCard } from "@/components/story/StoryCard";
import { StoryGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion";
import { PageHero } from "@/components/hero/PageHero";

export default function Stories() {
  const { get, setParams } = useQueryParams();
  const genre = get("genre", "all");
  const savedOnly = get("saved") === "1";
  const { slugs } = useBookmarks();
  const { topBeats, childBeats, genreBySlug, inGenre } = useTaxonomy();
  const reduced = useReducedMotion();

  const { data, loading, error, reload } = useAsync(() => api.stories(), []);
  const [retrying, setRetrying] = useState(false);

  const stories = useMemo(() => {
    let list = data ?? [];
    // `inGenre`, not equality: picking News has to bring back the pieces filed
    // under Kenya and Africa, or the parent chips would all read empty.
    if (genre !== "all") list = list.filter((s) => inGenre(s.genre, genre));
    if (savedOnly) list = list.filter((s) => slugs.includes(s.slug));
    return list;
    // `inGenre` is in the deps because it is no longer a module-level import:
    // it closes over the fetched taxonomy, so a filter computed before the
    // beats arrived would keep showing an unfiltered archive. The provider
    // memoises it, so its identity only changes when the beat list does.
  }, [data, genre, savedOnly, slugs, inGenre]);

  /**
   * The top-level beat currently in play.
   *
   * A child filter keeps its parent's chip lit and its sibling row open, so
   * moving between Kenya and Africa never looks like leaving News.
   */
  const activeParent = genre === "all" ? null : (genreBySlug(genre)?.parent ?? genre);
  const siblings = activeParent ? childBeats(activeParent) : [];

  // Filtering is not navigation — `useQueryParams` keeps the reader in place.
  const setFilter = (next: Record<string, string | null>) => setParams(next);

  return (
    <>
      <PageHero
        label="Archive"
        title={savedOnly ? "Saved stories" : "All stories"}
        lead={
          savedOnly
            ? "Everything you've kept for later, stored on this device."
            : "Investigations, profiles and essays. Every piece can be read or listened to."
        }
      />

      <div className="container-wide">

      {/* Filters */}
      <Reveal variant="fade-up" delay={80} className="mt-10 border-y border-border py-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={genre === "all"} onClick={() => setFilter({ genre: null })}>
            All
          </FilterChip>
          {topBeats.map((g) => (
            <FilterChip
              key={g.slug}
              active={genre === g.slug || activeParent === g.slug}
              onClick={() => setFilter({ genre: g.slug })}
            >
              {g.name}
            </FilterChip>
          ))}

          {/* Its own pill: the saved filter is independent of the genre
              filter, so both can be lit at once and they must not share a
              sliding indicator. */}
          <FilterChip
            active={savedOnly}
            onClick={() => setFilter({ saved: savedOnly ? null : "1" })}
            pillId="saved-pill"
            className="ml-auto"
          >
            <Bookmark
              className="h-3.5 w-3.5"
              fill={savedOnly ? "currentColor" : "none"}
              aria-hidden
            />
            Saved
            {slugs.length > 0 && <span className="tabular-nums opacity-70">{slugs.length}</span>}
          </FilterChip>
        </div>

        {/* The subjects inside the chosen beat, revealed only once one is
            chosen. Showing all twenty-one at once would put the filter bar
            four rows deep before a reader has expressed any interest, and the
            second row is where the archive actually gets specific. */}
        <AnimatePresence initial={false}>
          {siblings.length > 0 && (
            <motion.div
              key={activeParent}
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={transitions.normal}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="rule-label mr-1">In this beat</span>
                <FilterChip
                  active={genre === activeParent}
                  onClick={() => setFilter({ genre: activeParent })}
                  pillId="beat-child-pill"
                >
                  All
                </FilterChip>
                {siblings.map((child) => (
                  <FilterChip
                    key={child.slug}
                    active={genre === child.slug}
                    onClick={() => setFilter({ genre: child.slug })}
                    pillId="beat-child-pill"
                  >
                    {child.name}
                  </FilterChip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Reveal>

      <div className="mt-14 min-h-[40vh]">
        {loading ? (
          <StoryGridSkeleton />
        ) : error ? (
          <ErrorState
            description="The archive could not be loaded."
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              reload();
              window.setTimeout(() => setRetrying(false), 600);
            }}
          />
        ) : stories.length === 0 ? (
          savedOnly ? (
            <EmptyState
              icon={<Bookmark className="h-5 w-5" aria-hidden />}
              title="Nothing saved yet"
              description="Your saved stories will appear here. Tap the bookmark on any story to keep it for later."
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter({ saved: null })}>
                  Browse all stories
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No stories in this subject yet"
              description="This section is still being reported. Try another subject in the meantime."
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter({ genre: null })}>
                  Show everything
                </Button>
              }
            />
          )
        ) : (
          /* Filter changes reflow rather than reload: Motion's layout
             animation moves surviving cards to their new positions while
             the rest cross-fade. No spinner, no jump. */
          <motion.div
            layout={!reduced}
            transition={transitions.layout}
            className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:auto-rows-auto lg:grid-cols-6"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {stories.map((story, i) => (
                <motion.div
                  key={story.id}
                  className={bentoSpan(i)}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      ...transitions.normal,
                      delay: reduced ? 0 : Math.min(i, 6) * stagger.tight,
                    },
                  }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={transitions.normal}
                >
                  <StoryCard story={story} variant={i === 0 ? "feature" : "default"} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
      </div>
    </>
  );
}

/**
 * Bento spans for the archive.
 *
 * A uniform three-column grid says every piece matters equally, which is the
 * one thing an archive should never say. The lead runs full width, the next
 * two take halves, and the rest fall into thirds — the rhythm repeats every
 * six so a long list stays composed rather than turning into one wide row
 * followed by wallpaper.
 *
 * Only from `lg:` up. Below that the column is the layout, and imposing spans
 * on a single-column stack achieves nothing but a bigger stylesheet.
 */
function bentoSpan(index: number): string {
  const position = index % 6;
  if (position === 0) return "lg:col-span-6";
  if (position === 1 || position === 2) return "lg:col-span-3";
  return "lg:col-span-2";
}

function FilterChip({
  active,
  onClick,
  children,
  className,
  pillId = "filter-pill",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  pillId?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring press tap relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors",
        /*
         * ── The label waits for the pill ─────────────────────────────────
         * The pill is a `layoutId` shared element: it leaves the old chip and
         * slides to the new one over 320ms. The label's colour was crossfading
         * to white on the same tick the class flipped, which meant that for
         * the whole of that slide the newly-chosen beat was white text on the
         * near-white page — the one chip the reader was looking at was the one
         * they could not read, and it looked like the filter had blanked.
         *
         * Delaying only the incoming direction fixes it without slowing
         * anything down. Activating holds the dark label until the pill has
         * essentially arrived, then switches under it; de-activating carries
         * no delay, because the pill has already left and the label needs to
         * be dark again immediately. The two are different events and CSS
         * lets them have different timings — the delay lives on the active
         * class, so it applies when that class is being gained and not when
         * it is being lost.
         */
        active
          ? "text-primary-foreground delay-[260ms] duration-100"
          : "text-muted-foreground duration-normal hover:text-primary",
        className,
      )}
    >
      {active && (
        <motion.span
          layoutId={reduced ? undefined : pillId}
          className="absolute inset-0 rounded-full bg-primary"
          transition={transitions.normal}
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}
