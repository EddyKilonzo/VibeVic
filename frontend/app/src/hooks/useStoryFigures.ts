"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * What readers actually did, from the newsroom.
 *
 * ── What changed, and why the screens had to be rewritten around it ──────
 * `AdminReaders` opened by admitting there was no audience data: "no accounts,
 * no server, no third-party analytics script anywhere in the app". Two of those
 * three are still true and should stay true. The middle one stopped being true
 * when the API landed, and the screens went on saying it — so every figure they
 * showed came out of one browser's `localStorage` and was labelled, correctly
 * but uselessly, as "this device".
 *
 * The site now counts first-party, anonymously: a random per-tab string, no
 * cookie, no address, no profile, deduplicated per story per day. See
 * `lib/reader-events` for exactly what leaves a reader's browser, and the
 * `StoryEvent` model for what is kept.
 *
 * ── Absent is not zero ───────────────────────────────────────────────────
 * A story nobody has opened is not in this list at all. That distinction is
 * deliberate and is the one `lib/voice/analytics` already drew: "an article
 * that has never been played reports no plays, and the dashboard renders that
 * as 'no data yet' rather than as a zero-shaped chart." A zero looks like a
 * measurement. An absence is the truth this early.
 */

export interface StoryFigures {
  storyId: string;
  slug: string;
  title: string;
  views: number;
  reads: number;
  listens: number;
  /** Mean seconds per listening session. */
  avgListenSeconds: number;
  updatedAt: string;
}

export interface FiguresState {
  /** Null until the first answer — not an empty array, which would read as "nobody". */
  figures: StoryFigures[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Figures for one story, or null if it has none yet. */
  bySlug: (slug: string) => StoryFigures | null;
}

export function useStoryFigures(): FiguresState {
  const [figures, setFigures] = useState<StoryFigures[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);

    (async () => {
      try {
        const response = await fetch("/api/newsroom/analytics", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            body?.error ??
              (response.status === 401
                ? "Your newsroom session has expired."
                : `The newsroom returned ${response.status}.`),
          );
        }

        const rows = (await response.json()) as StoryFigures[];
        if (live) {
          setFigures(rows);
          setError(null);
        }
      } catch (cause) {
        // The figures stay null rather than becoming an empty array. A screen
        // that rendered "0 reads" over a failed request would be reporting a
        // measurement it does not have.
        if (live) setError(cause instanceof Error ? cause.message : "Something went wrong.");
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const bySlug = useCallback(
    (slug: string) => figures?.find((row) => row.slug === slug) ?? null,
    [figures],
  );

  return { figures, loading, error, reload, bySlug };
}

/** Totals across every story that has been read at all. */
export function totals(figures: StoryFigures[] | null) {
  if (!figures) return null;
  return figures.reduce(
    (sum, row) => ({
      views: sum.views + row.views,
      reads: sum.reads + row.reads,
      listens: sum.listens + row.listens,
    }),
    { views: 0, reads: 0, listens: 0 },
  );
}
