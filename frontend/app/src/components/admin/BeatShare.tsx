"use client";

import { GENRES, storiesByGenre } from "@/data/content";
import { VIDEOS } from "@/data/videos";

/**
 * How the work divides across the beats.
 *
 * ── Why this stopped being a stacked bar ─────────────────────────────────
 * It was one stacked bar in four validated colours, which was right when
 * there were four video topics. There are seven beats now, and three of them
 * hold only writing. A stacked bar at card width turns seven categories into
 * seven slivers, and giving each a colour would mean inventing three more
 * hues that have never been checked for colour-vision separation — the
 * existing four were, and amber against teal already sits close enough under
 * tritanopia to need a second encoding.
 *
 * So: a ranked list of bars, one hue, ordered by size. Length carries the
 * comparison, which is the thing a reader is actually doing, and every row is
 * directly labelled. Nothing depends on telling two colours apart.
 *
 * ── Why both halves are counted ──────────────────────────────────────────
 * It used to count video only, which understated every beat that has writing
 * on it and showed three beats as empty when they are not. The bar is the
 * total; the label breaks it down.
 */
export function BeatShare() {
  const rows = GENRES.map((genre) => {
    const reports = VIDEOS.filter((video) => video.topic === genre.slug).length;
    const written = storiesByGenre(genre.slug).length;
    return { slug: genre.slug, name: genre.name, reports, written, total: reports + written };
  })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const max = rows[0]?.total ?? 0;
  if (!max) return null;

  return (
    <ul className="space-y-3.5">
      {rows.map((row) => (
        <li key={row.slug}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.reports > 0 && `${row.reports} report${row.reports === 1 ? "" : "s"}`}
              {row.reports > 0 && row.written > 0 && " · "}
              {row.written > 0 && `${row.written} written`}
            </span>
          </div>

          <div
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary"
            role="img"
            aria-label={`${row.name}: ${row.total} ${row.total === 1 ? "piece" : "pieces"}`}
          >
            <span
              className="block h-full rounded-full bg-[hsl(var(--chart-seq))]"
              // Floored so a beat with one piece still shows a bar rather than
              // a hairline that reads as nothing.
              style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
