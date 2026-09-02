"use client";

import { useMemo, useState } from "react";
import { FolderOpen } from "lucide-react";
import { useCan } from "@/components/admin/SessionContext";
import { Reveal } from "@/components/motion";
import { RecordPanel } from "@/components/admin/RecordPanel";
import { WorkspaceTabs } from "@/components/admin/WorkspaceTabs";
import { useNewsroom } from "@/data/newsroom/useNewsroom";
import type { ListKey } from "@/data/newsroom/store";
import { RECORD_ORDER, RECORD_SCHEMAS, type RecordKey } from "@/lib/newsroom-schema";

/**
 * The whole record, across every piece.
 *
 * ── Why this exists as well as the story workspace ───────────────────────
 * Most reporting arrives attached to a piece, and `StoryRecords` is where it
 * is worked on. Two things do not fit there:
 *
 *   * Entities. A person or an organisation is not "about" one story — that
 *     is precisely why the pre-publication check can read them across the
 *     whole newsroom to spot a name spelled two ways. `Entity` is the one
 *     record in the model with no story link at all, so the workspace has
 *     nowhere to put it.
 *
 *   * Everything filed before it had a piece. A source you met at a
 *     conference, a document that turned up, a date that will matter later.
 *     Requiring a story first would mean inventing a draft to hold a name,
 *     and the draft would then be a story that does not exist.
 *
 * ── The same panel ───────────────────────────────────────────────────────
 * Every collection here renders through `RecordPanel`, unscoped. A record
 * created here has no story link; attaching it to one is done from the piece,
 * where the question "is this about that story" can actually be answered.
 */
export default function AdminRecords() {
  // Pitches are the notebook's, so a dev is not shown a tab that would refuse
  // them — see the same filter in `StoryRecords`.
  const canIdeas = useCan("newsroom:ideas");
  const shown = useMemo(
    () => RECORD_ORDER.filter((key) => RECORD_SCHEMAS[key].scope !== "newsroom:ideas" || canIdeas),
    [canIdeas],
  );

  const [active, setActive] = useState<RecordKey>(shown[0]!);

  // Named for the counts on the strip. The panel loads what it needs itself;
  // `ensureLoaded` holds one promise per collection, so this is a subscription
  // rather than a second set of requests.
  const { newsroom } = useNewsroom(...(shown as unknown as ListKey[]));

  return (
    <div className="pb-24">
      <Reveal variant="fade-up">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <FolderOpen className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Records
            </h1>
            <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              The newsroom in full. Material attached to a piece is easier to work on from
              the piece — this is where everything else lives, and where entities are kept,
              since a person is never about only one story.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal variant="fade-up" delay={40}>
        <div className="mt-7">
          <WorkspaceTabs
            tabs={shown.map((key) => ({
              id: key,
              label: RECORD_SCHEMAS[key].plural,
              count: (newsroom[key] as unknown[] | undefined)?.length || undefined,
            }))}
            active={active}
            onChange={(id) => setActive(id as RecordKey)}
          />
        </div>
      </Reveal>

      <Reveal variant="fade-up" delay={80}>
        <div className="mt-6">
          {/* Keyed, so switching collections does not carry one panel's open
              editor into the next. */}
          <RecordPanel key={active} collection={active} />
        </div>
      </Reveal>
    </div>
  );
}
