"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock, EyeOff, Headphones, LayoutGrid, List, PenLine, Search } from "lucide-react";
import type { StorySummary, StoryStatus } from "@/data/types";
import { ApiError, api } from "@/data/api";
import { LOCALE, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { useAsync } from "@/hooks/useAsync";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { storyCover } from "@/lib/cover";
import { ImageReveal, Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { newsroomPath } from "@/lib/newsroom-path";

/**
 * Status pills.
 *
 * `published` was `text-accent` on `bg-accent/12` — bright blue on a 12%
 * wash of itself, which measures 2.8:1. These are 11px semibold, nowhere
 * near the 18.7px that would let them count as large text, so 4.5:1 applies
 * and it missed by a wide margin.
 *
 * The three are now separated by fill weight rather than by hue alone:
 * solid for live, tinted-and-outlined for pending, flat grey for not yet.
 * That ordering is legible in greyscale and to every colour-vision type,
 * which colour-only pills are not. Measured on white card: 8.3:1, 7.3:1,
 * 5.4:1.
 */
const STATUS_STYLE: Record<StoryStatus, string> = {
  published: "bg-primary text-primary-foreground",
  scheduled: "bg-accent/12 text-primary ring-1 ring-inset ring-accent/35",
  draft: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

/** The dot inside the pill — decoration, riding the pill's own fill. */
const STATUS_DOT: Record<StoryStatus, string> = {
  published: "bg-primary-foreground",
  scheduled: "bg-accent",
  draft: "bg-muted-foreground/50",
};

/**
 * The card's left edge, coloured by state.
 *
 * Decoration on top of the pill, never instead of it: a 3px bar carries no
 * text and says nothing to anything that does not see colour, so the pill
 * beside it stays the thing that actually names the state. What the bar buys
 * is scanning — a column of twenty cards sorts itself before a single word
 * has been read.
 */
const STATUS_EDGE: Record<StoryStatus, string> = {
  published: "bg-primary",
  scheduled: "bg-accent",
  draft: "bg-border",
};

function StatusPill({ status, className }: { status: StoryStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {status}
    </span>
  );
}

export default function AdminStories() {
  const { genreLabel } = useTaxonomy();
  /**
   * `error` is read, not dropped.
   *
   * This list now comes from the API rather than a bundled array, and the
   * empty state below says "No stories match" — which, on a failed fetch,
   * tells a journalist their drafts are gone. They are not; the request
   * failed. The two have to look different.
   */
  const { data, loading, error, reload } = useAsync(() => api.allStories(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StoryStatus | "all">("all");
  /**
   * List or grid, remembered.
   *
   * Not component state: a view mode that resets on every navigation is one
   * the person has to re-choose all day, which makes it a worse default than
   * having no choice at all.
   */
  const [view, setView] = useLocalStorage<"list" | "grid">("vv:admin-stories-view", "list");
  /** Locally removed rows — the seed data itself is never mutated. */
  const [removed, setRemoved] = useState<string[]>([]);
  const reduced = useReducedMotion();

  const stories = useMemo(() => {
    let list = (data ?? []).filter((s) => !removed.includes(s.id));
    if (status !== "all") list = list.filter((s) => s.status === status);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || s.tags.join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, removed, status, query]);

  /**
   * Hides a row from this list. It does not delete anything, and no longer
   * says it does.
   *
   * ── Why this is not wired to the API ─────────────────────────────────────
   * There is no delete on `/admin/stories`, and its absence is not an oversight
   * to be filled in from here. A published story has an address readers have
   * saved and search engines hold; quotes, evidence and timeline events carry
   * `storyIds` pointing at it. Removing the row is the easy part of a decision
   * that also has to answer what those links become and what the old URL says —
   * the same shape of argument the API makes for not implementing `publish`.
   *
   * So the control does what it can honestly do: it takes a piece out of the
   * writer's way for this session. The label says "Hide", the toast says where
   * it went, and nothing claims a deletion that did not happen — which is the
   * bug this replaces, where a trash can quietly hid a story and a reload
   * brought it back.
   */
  const remove = (story: StorySummary) => {
    setRemoved((prev) => [...prev, story.id]);
    notify.undo(`“${story.title}” hidden from this list`, () =>
      setRemoved((prev) => prev.filter((id) => id !== story.id)),
    );
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="rule-label">Content</p>
            <h1 className="font-display display-2 mt-2 font-semibold">Stories</h1>
          </div>
          <Button as={Link} href={newsroomPath("/stories/new")} size="sm">
            <PenLine className="icon-lean h-4 w-4" aria-hidden />
            New story
          </Button>
        </div>
      </Reveal>

      <Reveal variant="fade-up" delay={70} className="mt-7 flex flex-wrap items-center gap-3">
        <div className="surface-compact flex h-10 min-w-[220px] flex-1 items-center gap-2 px-3 transition-colors focus-within:border-accent">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title or tag"
            aria-label="Filter stories"
            className="tap w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="surface-compact flex items-center gap-1 p-1">
          {(["all", "published", "draft", "scheduled"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={cn(
                "focus-ring tap relative inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold capitalize transition-colors duration-normal",
                status === value ? "text-primary-foreground" : "text-muted-foreground hover:text-primary",
              )}
            >
              {status === value && (
                <motion.span
                  layoutId={reduced ? undefined : "admin-status-pill"}
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={transitions.normal}
                />
              )}
              <span className="relative">{value}</span>
            </button>
          ))}
        </div>

        {/* List or grid. Icon-only, because the two shapes say it faster than
            the two words do — and both carry a label for anything not reading
            the picture. */}
        <div role="group" aria-label="View" className="surface-compact flex items-center gap-1 p-1">
          {(
            [
              { id: "list", label: "List view", Icon: List },
              { id: "grid", label: "Grid view", Icon: LayoutGrid },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              title={label}
              aria-label={label}
              className={cn(
                "focus-ring group relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-normal",
                view === id ? "text-primary-foreground" : "text-muted-foreground hover:text-primary",
              )}
            >
              {view === id && (
                <motion.span
                  layoutId={reduced ? undefined : "admin-view-pill"}
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={transitions.normal}
                />
              )}
              <Icon className="icon-pop relative h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
      </Reveal>

      {/* Both views are cards on the page ground, so neither sits inside a
          panel — a card list inside a card is two borders describing one
          thing. What separates them is density: the list is one wide card per
          story with a thumbnail, the grid is a cover-led tile. */}
      <div className="mt-6">
        {loading ? (
          <div className={cn("grid", view === "grid" ? "gap-4 sm:grid-cols-2 xl:grid-cols-3" : "gap-3")}>
            {Array.from({ length: view === "grid" ? 6 : 5 }, (_, i) =>
              view === "grid" ? (
                <div key={i} className="surface overflow-hidden">
                  <Skeleton className="aspect-[16/10] w-full rounded-none" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ) : (
                <div key={i} className="surface flex items-center gap-4 p-4">
                  <Skeleton className="hidden h-[58px] w-[92px] shrink-0 rounded-lg sm:block" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ),
            )}
          </div>
        ) : error ? (
          <ErrorState
            title="The story list could not be loaded."
            description={
              error instanceof ApiError && error.status === 401
                ? error.message
                : "Your drafts are safe — this request did not reach the API."
            }
            onRetry={reload}
          />
        ) : stories.length === 0 ? (
          <EmptyState
            title="No stories match"
            description="Try a different filter, or start something new."
            action={
              <Button as={Link} href={newsroomPath("/stories/new")} variant="outline" size="sm">
                New story
              </Button>
            }
          />
        ) : view === "grid" ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {stories.map((story, i) => (
                <motion.li
                  key={story.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { ...transitions.normal, delay: Math.min(i, 8) * stagger.tight },
                  }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  transition={transitions.normal}
                  className="surface surface-hover group relative flex flex-col overflow-hidden"
                >
                  <Link href={newsroomPath(`/stories/${story.id}`)} className="focus-ring block">
                    <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                      <ImageReveal
                        src={storyCover(story)}
                        alt=""
                        ratio="16/10"
                        sizes="(min-width: 1280px) 320px, (min-width: 640px) 45vw, 90vw"
                        className="media-zoom h-full w-full"
                      />
                      <StatusPill
                        status={story.status}
                        className="absolute left-3 top-3 shadow-raised"
                      />
                    </div>
                  </Link>

                  <div className="flex min-h-0 flex-1 flex-col p-4">
                    <Link href={newsroomPath(`/stories/${story.id}`)} className="focus-ring min-w-0">
                      <p className="font-display line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">
                        {story.title}
                      </p>
                    </Link>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {genreLabel(story.genre)} · edited {formatRelative(story.updatedAt)}
                    </p>

                    <div className="mt-auto flex items-center gap-3 pt-4">
                      {story.stats && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Headphones className="icon-lean h-3.5 w-3.5" aria-hidden />
                          {story.stats.listens.toLocaleString(LOCALE)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(story)}
                        aria-label={`Hide ${story.title} from this list`}
                        className="focus-ring tap-square ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-muted hover:text-primary"
                      >
                        <EyeOff className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <ul className="grid gap-3">
            <AnimatePresence initial={false}>
              {stories.map((story, i) => (
                <motion.li
                  key={story.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { ...transitions.normal, delay: Math.min(i, 8) * stagger.tight },
                  }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={transitions.normal}
                  className="surface surface-hover group relative overflow-hidden"
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 w-[3px]", STATUS_EDGE[story.status])}
                  />

                  <div className="flex items-center gap-4 py-3 pl-4 pr-3 sm:gap-5 sm:py-4 sm:pl-5 sm:pr-4">
                    {/* The cover, repeated from the destination the title
                        already links to — so it is hidden from assistive tech
                        and skipped by the keyboard rather than read out as a
                        second identical link. */}
                    <Link
                      href={newsroomPath(`/stories/${story.id}`)}
                      tabIndex={-1}
                      aria-hidden
                      className="hidden h-[58px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-secondary sm:block"
                    >
                      <ImageReveal
                        src={storyCover(story)}
                        alt=""
                        ratio="16/10"
                        sizes="92px"
                        className="media-zoom h-full w-full"
                      />
                    </Link>

                    <Link href={newsroomPath(`/stories/${story.id}`)} className="focus-ring min-w-0 flex-1">
                      <p className="font-display truncate text-[15px] font-semibold leading-snug tracking-tight">
                        {story.title}
                      </p>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate">{genreLabel(story.genre)}</span>
                        <span aria-hidden className="text-border">
                          ·
                        </span>
                        <span>edited {formatRelative(story.updatedAt)}</span>
                        <span aria-hidden className="hidden text-border sm:inline">
                          ·
                        </span>
                        <span className="hidden items-center gap-1.5 sm:inline-flex">
                          <Clock className="icon-lean h-3.5 w-3.5" aria-hidden />
                          {story.readingMinutes} min
                        </span>
                      </span>
                    </Link>

                    <div className="flex shrink-0 items-center gap-3">
                      {story.stats && (
                        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
                          <Headphones className="icon-lean h-3.5 w-3.5" aria-hidden />
                          {story.stats.listens.toLocaleString(LOCALE)}
                        </span>
                      )}

                      <StatusPill status={story.status} />

                      <button
                        type="button"
                        onClick={() => remove(story)}
                        aria-label={`Hide ${story.title} from this list`}
                        className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-muted hover:text-primary md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                      >
                        <EyeOff className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
