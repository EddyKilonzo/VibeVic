"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Headphones, PenLine, Search, Trash2 } from "lucide-react";
import type { Story, StoryStatus } from "@/data/types";
import { api } from "@/data/api";
import { genreName } from "@/data/content";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { useAsync } from "@/hooks/useAsync";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";

const STATUS_STYLE: Record<StoryStatus, string> = {
  published: "bg-accent/12 text-accent",
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-secondary text-primary",
};

export default function AdminStories() {
  const { data, loading } = useAsync(() => api.allStories(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StoryStatus | "all">("all");
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
            <PenLine className="h-4 w-4" aria-hidden />
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
                "focus-ring tap relative inline-flex h-8 items-center rounded px-3 text-xs font-semibold capitalize transition-colors duration-normal",
                status === value ? "text-primary-foreground" : "text-muted-foreground hover:text-primary",
              )}
            >
              {status === value && (
                <motion.span
                  layoutId={reduced ? undefined : "admin-status-pill"}
                  className="absolute inset-0 rounded bg-primary"
                  transition={transitions.normal}
                />
              )}
              <span className="relative">{value}</span>
            </button>
          ))}
        </div>
      </Reveal>

      <div className="surface mt-6 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : stories.length === 0 ? (
          <EmptyState
            title="No stories match"
            description="Try a different filter, or start something new."
            className="border-0"
            action={
              <Button as={Link} href="/admin/stories/new" variant="outline" size="sm">
                New story
              </Button>
            }
          />
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
                        <Headphones className="h-3.5 w-3.5" aria-hidden />
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
                      className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
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
