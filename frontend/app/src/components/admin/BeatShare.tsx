"use client";

import { TOPICS, VIDEOS } from "@/data/videos";
import { cn } from "@/lib/utils";

/**
 * How the reporting divides across the four beats.
 *
 * A single stacked bar rather than a pie: the question is "what share of the
 * work is each beat", and a length along one axis is read accurately where the
 * angles of a pie are not. Four categories is also the point at which a pie
 * stops being readable at card size.
 *
 * Colour carries identity here, so it is never the only encoding — every
 * segment is directly labelled in the legend below with its own count, and the
 * segments are separated by a 2px surface gap. That gap is required rather than
 * decorative: the amber and teal slots sit at ΔE 6.1 under tritanopia, inside
 * the band where a second encoding is mandatory.
 */
export function BeatShare() {
  const counts = TOPICS.map((topic, i) => ({
    slug: topic.slug,
    name: topic.name,
    count: VIDEOS.filter((v) => v.topic === topic.slug).length,
    color: `hsl(var(--chart-${i + 1}))`,
  })).filter((t) => t.count > 0);

  const total = counts.reduce((n, t) => n + t.count, 0);
  if (!total) return null;

  return (
    <div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={`Reports by beat: ${counts.map((c) => `${c.name} ${c.count}`).join(", ")}`}
      >
        {counts.map((t) => (
          <span
            key={t.slug}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(t.count / total) * 100}%`, background: t.color }}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {counts.map((t) => (
          <li key={t.slug} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: t.color }}
            />
            {/* Label and value in text tokens, never the series colour. */}
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.name}</span>
            <span className={cn("shrink-0 font-semibold tabular-nums text-foreground")}>
              {t.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
