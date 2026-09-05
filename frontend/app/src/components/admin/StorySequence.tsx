"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useNewsroom } from "@/data/newsroom/useNewsroom";
import type { TimelineEvent } from "@/data/newsroom/types";

/**
 * The events filed against this piece, in the order they happened.
 *
 * ── Why this exists when the timeline already has a tab ──────────────────
 * `RecordPanel` can already list, create and edit timeline events, and that
 * is the whole of what the collection had: create, read, update, delete, in
 * the order the rows came back. Which meant the one thing a timeline is for
 * — seeing whether a sequence holds together — was the one thing it could
 * not do. Filing events was bookkeeping with no payoff, and the extractor
 * added alongside it was a producer with no consumer.
 *
 * This is the read-back. Sorted by `occurredAt`, gaps between events shown as
 * gaps, and nothing editable: the tab is where events are worked on, and a
 * second place to edit one would be a second place for the two to disagree.
 *
 * ── Why it is not on the public story page ───────────────────────────────
 * The obvious next step, and deliberately not taken here. A timeline event
 * carries `entityIds` and `evidenceIds`, and the newsroom module's own note
 * describes the collection as "untiered but linked to tiered" — the row is
 * readable by anyone in the newsroom while its links are filtered, so that an
 * event stays in the sequence without announcing which protected source it
 * touches. Publishing the sequence is a decision about what a reader may
 * infer from that, and it is the journalist's to make rather than a side
 * effect of adding a panel.
 */
export function StorySequence({ storyId }: { storyId: string | null }) {
  const { newsroom, loading } = useNewsroom("timeline");

  const events = useMemo(() => {
    if (!storyId) return [];
    return (newsroom.timeline as TimelineEvent[])
      .filter((event) => event.storyIds?.includes(storyId))
      .slice()
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }, [newsroom.timeline, storyId]);

  // Nothing filed is not a state worth a panel. A writer who has not built a
  // sequence is not missing one, and an empty box under the draft saying so
  // every time would be a reproach rather than information.
  if (!storyId || loading || events.length === 0) return null;

  return (
    <section className="surface mt-4 p-5">
      <h3 className="font-display flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
        <CalendarClock className="h-4 w-4 text-accent" aria-hidden />
        The sequence
      </h3>
      <p className="mt-1 max-w-[62ch] text-[11px] leading-snug text-muted-foreground">
        {events.length} event{events.length === 1 ? "" : "s"} filed against this piece, oldest
        first. Edit them under Records → Timeline.
      </p>

      <ol className="mt-4">
        {events.map((event, index) => (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* The rule runs between the dots rather than through them, and
                stops at the last one — a line continuing past the final event
                would imply the sequence carries on past what is filed. */}
            {index < events.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[3.5px] top-2.5 h-full w-px bg-border"
              />
            )}
            <span
              aria-hidden
              className="relative mt-2 h-2 w-2 shrink-0 rounded-full bg-accent"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {stamp(event.occurredAt)}
              </p>
              <p className="mt-0.5 max-w-[68ch] text-[13px] leading-relaxed text-foreground">
                {event.what}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The date, and only as much of it as the row can support.
 *
 * `occurredAt` is a timestamp because the column is one, but a piece often
 * fixes an event to a month and no closer — the extractor records that in its
 * own `precision` field and stores the first instant of the month. Nothing
 * carries that precision onto the row, so this prints the day it was given
 * and does not invent a time of day to go with it.
 */
function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
