"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Headphones, LayoutGrid, List, PenLine, Search, Trash2 } from "lucide-react";
import type { Story, StoryStatus } from "@/data/types";
import { api } from "@/data/api";
import { genreName } from "@/data/content";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { useAsync } from "@/hooks/useAsync";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { storyCover } from "@/lib/cover";
import { ImageReveal } from "@/components/motion";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";

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

export default function AdminStories() {
  const { data, loading } = useAsync(() => api.allStories(), []);
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

  const remove = (story: Story) => {
    setRemoved((prev) => [...prev, story.id]);
    notify.undo(`“${story.title}” deleted`, () =>
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
          <Button as={Link} href="/admin/stories/new" size="sm">
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

      {/* The grid is a set of cards on the page ground, not rows inside one
          panel — so the container only becomes a `.surface` in list view.
          A card grid inside a card is two borders describing one thing. */}
      <div className={cn("mt-6", view === "list" && "surface overflow-hidden")}>
        {loading ? (
          view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="surface overflow-hidden">
                  <Skeleton className="aspect-[16/10] w-full rounded-none" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          )
        ) : stories.length === 0 ? (
          <EmptyState
            title="No stories match"
            description="Try a different filter, or start something new."
            className={view === "list" ? "border-0" : undefined}
            action={
              <Button as={Link} href="/admin/stories/new" variant="outline" size="sm">
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
                  <Link href={`/admin/stories/${story.id}`} className="focus-ring block">
                    <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                      <ImageReveal
                        src={storyCover(story)}
                        alt=""
                        ratio="16/10"
                        sizes="(min-width: 1280px) 320px, (min-width: 640px) 45vw, 90vw"
                        className="media-zoom h-full w-full"
                      />
                      <span
                        className={cn(
                          "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize shadow-raised",
                          STATUS_STYLE[story.status],
                        )}
                      >
                        {story.status}
                      </span>
                    </div>
                  </Link>

                  <div className="flex min-h-0 flex-1 flex-col p-4">
                    <Link href={`/admin/stories/${story.id}`} className="focus-ring min-w-0">
                      <p className="font-display line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">
                        {story.title}
                      </p>
                    </Link>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {genreName(story.genre)} · edited {formatRelative(story.updatedAt)}
                    </p>

                    <div className="mt-auto flex items-center gap-3 pt-4">
                      {story.stats && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Headphones className="icon-lean h-3.5 w-3.5" aria-hidden />
                          {story.stats.listens.toLocaleString()}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(story)}
                        aria-label={`Delete ${story.title}`}
                        className="focus-ring tap-square ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <ul className="divide-y divide-border">
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
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12, height: 0 }}
                  transition={transitions.normal}
                  className="group relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50">
                    <Link
                      href={`/admin/stories/${story.id}`}
                      className="focus-ring min-w-0 flex-1"
                    >
                      <p className="truncate font-semibold tracking-tight">{story.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {genreName(story.genre)} · edited {formatRelative(story.updatedAt)}
                      </p>
                    </Link>

                    {story.stats && (
                      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                        <Headphones className="icon-lean h-3.5 w-3.5" aria-hidden />
                        {story.stats.listens.toLocaleString()}
                      </span>
                    )}

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                        STATUS_STYLE[story.status],
                      )}
                    >
                      {story.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => remove(story)}
                      aria-label={`Delete ${story.title}`}
                      className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
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
