"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { Search as SearchIcon } from "lucide-react";
import { api } from "@/data/api";
import { useAsync } from "@/hooks/useAsync";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { StoryCard } from "@/components/story/StoryCard";
import { StoryGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";

export default function Search() {
  const { get, setParams } = useQueryParams();
  const initial = get("q");
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing shouldn't hammer the API or rewrite history on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(query);
      setParams({ q: query || null }, { replace: true });
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, setParams]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, loading } = useAsync(
    () => (debounced.trim() ? api.search(debounced) : Promise.resolve([])),
    [debounced],
  );

  const results = data ?? [];
  const searching = debounced.trim().length > 0;

  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Search</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
          Find a story
        </h1>
      </Reveal>

      <Reveal variant="fade-up" delay={70} className="mt-10">
        <div className="flex items-center gap-3 border-b-2 border-border pb-3 transition-colors duration-normal focus-within:border-accent">
          <SearchIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Housing, algorithms, the coastline…"
            aria-label="Search stories"
            className="font-display w-full bg-transparent text-2xl outline-none placeholder:text-muted-foreground/60 sm:text-3xl"
          />
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {!searching
            ? "Search titles, subjects and the full text of every published story."
            : loading
              ? "Searching…"
              : `${results.length} ${results.length === 1 ? "story" : "stories"} for “${debounced}”`}
        </p>
      </Reveal>

      <div className="mt-14 min-h-[35vh]">
        {searching && loading ? (
          <StoryGridSkeleton count={3} />
        ) : searching && results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" aria-hidden />}
            title="Nothing matched"
            description="Try a broader term — a subject, a place, or the name of a publication."
          />
        ) : searching ? (
          <Stagger className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" step="tight">
            {results.map((story, i) => (
              <StaggerItem key={story.id} index={i}>
                <StoryCard story={story} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : null}
      </div>
    </div>
  );
}
