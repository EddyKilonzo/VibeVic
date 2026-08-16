"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CornerDownLeft, Search as SearchIcon } from "lucide-react";
import { genreName, searchStories } from "@/data/content";
import { formatShortDate } from "@/lib/format";
import { stagger, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/ui/Overlay";

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const MAX_RESULTS = 6;

/**
 * Quick search.
 *
 * Results are keyboard-first: ↑/↓ move the selection, Enter opens it, Escape
 * closes. The list is capped and the full result set lives on /search, so the
 * overlay stays a jump-to rather than a page inside a page.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchStories(query).slice(0, MAX_RESULTS), [query]);

  // Two pieces of state that follow other state, adjusted during render rather
  // than in an effect: the overlay must never paint for a frame showing the
  // previous session's query, or a highlight sitting on a row that the new
  // results no longer contain.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setActive(0);
  }

  // Focus is a DOM effect, not state, so it stays here. The delay lets the
  // panel finish its entrance before the caret lands.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const go = (slug: string) => {
    onClose();
    router.push(`/stories/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active].slug);
      else if (query.trim()) {
        onClose();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      from="top"
      label="Search stories"
      className="items-start justify-center"
      panelClassName="mx-auto max-w-[680px] px-4 pt-[10vh] sm:pt-[14vh]"
    >
      <div className="glass-strong overflow-hidden rounded-xl shadow-deep">
        <div className="flex items-center gap-3 border-b border-border/60 px-5">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search stories, genres, subjects…"
            aria-label="Search stories"
            aria-controls="search-overlay-results"
            className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div id="search-overlay-results" role="listbox" aria-label="Search results">
          <AnimatePresence mode="wait" initial={false}>
            {query.trim() === "" ? (
              <motion.p
                key="hint"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transitions.fast}
                className="px-5 py-8 text-center text-sm text-muted-foreground"
              >
                Search across every published story.
              </motion.p>
            ) : results.length === 0 ? (
              <motion.p
                key="empty"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transitions.fast}
                className="px-5 py-8 text-center text-sm text-muted-foreground"
              >
                No stories match <span className="font-semibold text-foreground">“{query}”</span>.
              </motion.p>
            ) : (
              <motion.ul key="results" className="max-h-[52vh] overflow-y-auto py-2">
                {results.map((story, i) => (
                  <motion.li
                    key={story.slug}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...transitions.normal,
                      delay: reduced ? 0 : i * stagger.tight,
                    }}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(story.slug)}
                      className={cn(
                        "focus-ring group flex w-full items-start gap-4 px-5 py-3 text-left transition-colors duration-fast",
                        i === active && "bg-secondary/70",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-display block truncate text-[15px] font-semibold tracking-tight">
                          {story.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {genreName(story.genre)} · {formatShortDate(story.publishedAt)} ·{" "}
                          {story.readingMinutes} min
                        </span>
                      </span>
                      <CornerDownLeft
                        className={cn(
                          "mt-1 h-3.5 w-3.5 shrink-0 text-accent transition-opacity duration-fast",
                          i === active ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {query.trim() && results.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
            className="focus-ring w-full border-t border-border/60 px-5 py-3 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            See all results for “{query.trim()}”
          </button>
        )}
      </div>
    </Overlay>
  );
}
