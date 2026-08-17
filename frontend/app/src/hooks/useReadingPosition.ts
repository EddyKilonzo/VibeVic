"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const KEY = "vv:reading-position";

/** Below this, there is nothing to resume; above it, the piece is finished. */
const FLOOR = 0.08;
const CEILING = 0.94;

/** Positions older than this are not offered — the reader has moved on. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

type Positions = Record<string, { progress: number; at: number }>;

function read(): Positions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Positions) : {};
  } catch {
    // A corrupt or unavailable store is not worth a broken article.
    return {};
  }
}

function write(positions: Positions) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    // Private mode, or a full quota. Losing a bookmark is not an error the
    // reader needs to hear about.
  }
}

/**
 * The offer for each slug, decided once and then held.
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`, so the getter it
 * calls has to return the *same* value every time until something actually
 * changes — reading and re-deriving from localStorage on each call would be
 * stable here by luck, and would stop being stable the moment the shape of the
 * stored value grew. Deciding once and caching is the version that cannot
 * spin.
 */
const offers = new Map<string, number | null>();
const listeners = new Set<() => void>();

function offerFor(slug: string): number | null {
  const cached = offers.get(slug);
  if (cached !== undefined) return cached;

  const entry = read()[slug];
  const usable =
    entry !== undefined &&
    Date.now() - entry.at <= MAX_AGE_MS &&
    entry.progress >= FLOOR &&
    entry.progress <= CEILING;

  const value = usable ? entry.progress : null;
  offers.set(slug, value);
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Remembers how far into a piece the reader got, and offers it back.
 *
 * ── It offers; it does not act ───────────────────────────────────────────
 * The tempting version of this restores the scroll position automatically.
 * That is the version people hate: you open a link someone sent you, and the
 * page throws you into the middle of an article you wanted to start again, or
 * worse, past the paragraph you were about to quote. So the position is read
 * once on mount and handed back as a number for the caller to *offer*. The
 * jump only ever happens because the reader asked for it.
 *
 * The saved value is a fraction, not a pixel offset. Pixels are meaningless
 * across a different window width, a different text size, or an edit to the
 * piece; a fraction lands in roughly the right paragraph in all three cases.
 */
export function useReadingPosition(slug: string) {
  const latest = useRef(0);

  /**
   * Read through an external store rather than in an effect: localStorage is
   * exactly the "external system" this hook is for, the server has no answer
   * for it, and React's own hydration handling for the two snapshots is
   * better than a mount effect that renders twice on every article.
   */
  const saved = useSyncExternalStore(
    subscribe,
    () => offerFor(slug),
    () => null,
  );

  /** Called as the reader moves. Cheap: it only records into a ref. */
  const record = useCallback((progress: number) => {
    latest.current = progress;
  }, []);

  // Written on the way out rather than on every scroll — one storage write per
  // visit instead of hundreds, and `pagehide` is the event that actually fires
  // when a phone browser is backgrounded, which `beforeunload` does not.
  useEffect(() => {
    const persist = () => {
      const progress = latest.current;
      const positions = read();

      if (progress < FLOOR || progress > CEILING) {
        // Finished, or never really started. Either way there is nothing worth
        // resuming, and leaving a stale mark would offer the wrong place.
        delete positions[slug];
      } else {
        positions[slug] = { progress, at: Date.now() };
      }

      write(positions);
    };

    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      persist();
      // Drop the cached offer so the next visit to this piece reads the mark
      // that was just written rather than the one this visit started with.
      offers.delete(slug);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [slug]);

  /** Dismisses the offer for this visit. The mark itself is left alone. */
  const decline = useCallback(() => {
    offers.set(slug, null);
    listeners.forEach((listener) => listener());
  }, [slug]);

  return { saved, record, decline };
}
