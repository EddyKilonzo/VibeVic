"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  curationErrorOf,
  curationStatusOf,
  ensureCuration,
  ensureLoaded,
  errorOf,
  fetchCounts,
  reloadCuration,
  getServerSnapshot,
  getSnapshot,
  reload,
  statusOf,
  subscribe,
  type ListKey,
  type NewsroomCounts,
} from "./store";
import type { Newsroom } from "./types";

/**
 * Read the newsroom.
 *
 * `useSyncExternalStore` rather than context, because the store is a genuine
 * external system: it is written from event handlers, from other tabs, and now
 * from a server. Every consumer re-renders from the same snapshot, so two
 * screens can never disagree about what is saved.
 *
 * ── Why the collections are named ────────────────────────────────────────
 * The old hook took no arguments and could not: the whole workspace was already
 * in memory, so there was nothing to ask for. Against an API there is, and a
 * hook that fetched all eleven collections whenever any screen wanted one of
 * them would download every source and interview note to render a list of
 * ideas. Naming what you need is one word per screen and it is the difference
 * between one request and eleven.
 */
export interface NewsroomView {
  newsroom: Newsroom;
  /** True while any named collection is still on its first load. */
  loading: boolean;
  /** The first failure among the named collections, or null. */
  error: string | null;
  /** Refetches the named collections. */
  refresh: () => void;
}

export function useNewsroom(...keys: ListKey[]): NewsroomView {
  const newsroom = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Stable across renders as long as the names are the same, so the effect
  // below does not re-run on every keystroke in the screen that uses it.
  //
  // The dependency is the joined string, and the memo rebuilds the list from
  // it rather than from `keys`. The rest parameter is a new array on every
  // call, so it cannot be the dependency; joining it inside the list made the
  // dependency an expression the linter cannot track, which is what the
  // suppression comment that used to sit here was hiding.
  const named = keys.join("|");
  const wanted = useMemo(
    () => (named === "" ? [] : (named.split("|") as ListKey[]).sort()),
    [named],
  );

  useEffect(() => {
    for (const key of wanted) void ensureLoaded(key);
  }, [wanted]);

  // Load state lives outside React, so it is subscribed to rather than read:
  // reading it during render would miss the transition from loading to ready,
  // which arrives with an emit rather than with new snapshot data.
  const loadStates = useSyncExternalStore(
    subscribe,
    () => wanted.map((key) => `${statusOf(key)}:${errorOf(key) ?? ""}`).join("|"),
    () => wanted.map(() => "idle:").join("|"),
  );

  const { loading, error } = useMemo(() => {
    const parts = loadStates.split("|").filter(Boolean);
    return {
      loading: parts.some((part) => part.startsWith("loading") || part.startsWith("idle")),
      error: parts.map((part) => part.split(":")[1]).find(Boolean) ?? null,
    };
  }, [loadStates]);

  const refresh = useCallback(() => {
    for (const key of wanted) void reload(key);
  }, [wanted]);

  return { newsroom, loading, error, refresh };
}

/**
 * Read the curation the journalist has applied to their own work.
 *
 * Separate from `useNewsroom` for the reason the store keeps them separate:
 * neither the portfolio map nor the style guide is a list of records, so
 * neither has a `ListKey` and neither can be named in that hook. The shape of
 * this one is otherwise identical, so a screen that uses both reads the same.
 */
export function useCuration(): {
  portfolio: Newsroom["portfolio"];
  styleGuide: Newsroom["styleGuide"];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const newsroom = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void ensureCuration();
  }, []);

  const load = useSyncExternalStore(
    subscribe,
    () => `${curationStatusOf()}:${curationErrorOf() ?? ""}`,
    () => "idle:",
  );

  const [state, message] = load.split(/:(.*)/s);
  const refresh = useCallback(() => {
    void reloadCuration();
  }, []);

  return {
    portfolio: newsroom.portfolio,
    styleGuide: newsroom.styleGuide,
    loading: state === "loading" || state === "idle",
    error: message || null,
    refresh,
  };
}

/**
 * How many records the newsroom holds.
 *
 * Separate from `useNewsroom` because it is a different question with a much
 * cheaper answer — one request that returns numbers rather than eleven that
 * return material. The settings screen is the only caller and only ever wanted
 * the total.
 */
export function useNewsroomCounts(): {
  counts: NewsroomCounts | null;
  total: number | null;
  error: string | null;
} {
  const [counts, setCounts] = useState<NewsroomCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchCounts()
      .then((value) => {
        if (live) setCounts(value);
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : "Something went wrong.");
      });
    return () => {
      live = false;
    };
  }, []);

  const total = counts
    ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0)
    : null;

  return { counts, total, error };
}

export * from "./store";
export * from "./types";
