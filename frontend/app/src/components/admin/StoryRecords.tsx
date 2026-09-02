"use client";

import { useMemo, useState } from "react";
import { useCan } from "@/components/admin/SessionContext";
import { useNewsroom } from "@/data/newsroom/useNewsroom";
import type { ListKey } from "@/data/newsroom/store";
import { RecordPanel } from "@/components/admin/RecordPanel";
import { WorkspaceTabs } from "@/components/admin/WorkspaceTabs";
import {
  RECORD_SCHEMAS,
  STORY_RECORD_ORDER,
  type Draft,
  type RecordKey,
} from "@/lib/newsroom-schema";

/**
 * Everything behind this piece, under the piece.
 *
 * ── What was missing ─────────────────────────────────────────────────────
 * The API has served sources, quotes, interviews, evidence, timeline events,
 * notes and deadlines since the newsroom was built, and the admin had no
 * screen for any of them. A journalist could file an interview through curl
 * and nowhere else. The one place the collections surfaced was a total on the
 * settings page — "47 records" — with no way to open one of them.
 *
 * ── Why here rather than seven pages ─────────────────────────────────────
 * `WorkspaceTabs` has been sitting in this directory, finished and mounted
 * nowhere, since the workspace was designed. Its own comment states the
 * principle it was written for: "One story, one screen: the brief's first
 * principle is that reporting should not be scattered across pages you have to
 * remember to visit." That is exactly the shape this material wants. The
 * interview you did for a piece belongs with the piece, not in a separate
 * archive you would have to think to open.
 *
 * The tabs sit below the draft rather than swallowing it. A writer opens this
 * screen to write; the record is what they reach for while writing, and a tab
 * strip that hid the paragraph they were mid-way through would make checking a
 * quote cost the thing they came here to do.
 *
 * ── The counts are real ──────────────────────────────────────────────────
 * Each tab carries how many records this story actually has, and omits the
 * number when it is zero rather than showing a nought. `WorkspaceTabs` asks
 * for that in its own type — "omitted when zero, never faked" — and the point
 * is that a superscript on a tab should mean there is something to find there.
 */
export function StoryRecords({ storyId }: { storyId: string | null }) {
  /*
   * Only the collections this account can actually open.
   *
   * Pitches are the one with a scope of its own — the notebook is the
   * writer's — so a dev sees six tabs where a writer sees seven. Drawing a tab
   * that answers 403 when pressed would be worse than not drawing it: it tells
   * them something exists that they are then refused, which is exactly what
   * `newsroom:ideas` was split off to avoid.
   */
  const canIdeas = useCan("newsroom:ideas");
  const shown = useMemo(
    () =>
      STORY_RECORD_ORDER.filter(
        (key) => RECORD_SCHEMAS[key].scope !== "newsroom:ideas" || canIdeas,
      ),
    [canIdeas],
  );

  // The first tab this account can actually open — `shown`, not the full
  // order, or a dev would land on the pitches tab that was just filtered out.
  const [active, setActive] = useState<RecordKey>(shown[0]!);

  /*
   * Every story-linked collection, loaded here so the strip can count.
   *
   * The panel below asks for what it needs on its own, and asking twice costs
   * nothing: `ensureLoaded` keeps one in-flight promise per collection and
   * serves the cache afterwards, so these names are a subscription rather than
   * a second round of requests.
   */
  const { newsroom } = useNewsroom(...(shown as unknown as ListKey[]));

  const counts = useMemo(() => {
    const out: Partial<Record<RecordKey, number>> = {};
    if (!storyId) return out;

    for (const key of shown) {
      const rows = (newsroom[key] as unknown as Draft[]) ?? [];
      const link = RECORD_SCHEMAS[key].storyLink;
      out[key] = rows.filter((row) =>
        link === "many"
          ? Array.isArray(row.storyIds) && (row.storyIds as string[]).includes(storyId)
          : row.storyId === storyId,
      ).length;
    }
    return out;
  }, [newsroom, storyId, shown]);

  /*
   * A piece with no record yet has nothing to attach anything to.
   *
   * Said plainly rather than shown as seven empty tabs. An "Add source" button
   * that could only fail is worse than an absence with a reason: the writer
   * presses it, gets an error about a record that does not exist, and learns
   * nothing about what to do next. Saving once is what to do next.
   */
  if (!storyId) {
    return (
      <section className="mt-10 border-t border-border pt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          The reporting behind it
        </h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
          Sources, quotes, interviews, evidence, the timeline, your notes and what is due —
          all of it filed against this piece. Give it a headline and let it save once, and
          this opens.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
        The reporting behind it
      </h2>

      <div className="mt-4">
        <WorkspaceTabs
          tabs={shown.map((key) => ({
            id: key,
            label: RECORD_SCHEMAS[key].plural,
            count: counts[key] || undefined,
          }))}
          active={active}
          onChange={(id) => setActive(id as RecordKey)}
        />
      </div>

      <div className="mt-5">
        {/* Keyed on the collection so switching tabs starts the panel fresh
            rather than carrying one collection's open editor into another —
            which would show a source's fields against a quote's row. */}
        <RecordPanel key={active} collection={active} storyId={storyId} />
      </div>
    </section>
  );
}
