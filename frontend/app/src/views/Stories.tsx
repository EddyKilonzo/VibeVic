"use client";

import { useMemo, useState } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark } from "lucide-react";
import { GENRES } from "@/data/content";
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

export default function Stories() {
  const { get, setParams } = useQueryParams();
  const genre = get("genre", "all");
  const savedOnly = get("saved") === "1";
  const { slugs } = useBookmarks();
  const reduced = useReducedMotion();

  const { data, loading, error, reload } = useAsync(() => api.stories(), []);
  const [retrying, setRetrying] = useState(false);

  const stories = useMemo(() => {
    let list = data ?? [];
    if (genre !== "all") list = list.filter((s) => s.genre === genre);
    if (savedOnly) list = list.filter((s) => slugs.includes(s.slug));
    return list;
  }, [data, genre, savedOnly, slugs]);

  // Filtering is not navigation — `useQueryParams` keeps the reader in place.
  const setFilter = (next: Record<string, string | null>) => setParams(next);

  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Archive</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {savedOnly ? "Saved stories" : "All stories"}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {savedOnly
            ? "Everything you've kept for later, stored on this device."
            : "Investigations, profiles and essays. Every piece can be read or listened to."}
        </p>
      </Reveal>

      {/* Filters */}
      <Reveal variant="fade-up" delay={80} className="mt-10 border-y border-border py-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={genre === "all"} onClick={() => setFilter({ genre: null })}>
            All
          </FilterChip>
          {GENRES.map((g) => (
            <FilterChip
              key={g.slug}
              active={genre === g.slug}
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
            className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {stories.map((story, i) => (
                <motion.div
                  key={story.id}
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
                  <StoryCard story={story} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
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
        "focus-ring press relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors duration-normal",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-primary",
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
