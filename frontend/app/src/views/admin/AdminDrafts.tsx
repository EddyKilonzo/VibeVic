"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, PenLine, Trash2 } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import {
  discardDraft,
  draftWordCount,
  listDrafts,
  writeDraft,
  type StoredDraft,
} from "@/lib/drafts";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { newsroomPath } from "@/lib/newsroom-path";

/**
 * Everything saved on this device and not yet sent anywhere.
 *
 * The workspace has autosaved to `localStorage` since the write became real,
 * but there was no way to see what it had — a store you cannot enumerate is a
 * store you cannot trust, and a writer with three half-finished pieces had to
 * remember all three URLs. This is the list.
 *
 * It is explicitly *this device*, and it still is now that the workspace sends
 * every save to Postgres as well. What this page enumerates is the local copy,
 * which is written first on every autosave and survives a failed request — so a
 * row here is not proof the newsroom has the piece. Usually it does; the case
 * worth being able to see is the one where it does not, and that is precisely
 * the case a page saying "my drafts" would hide.
 *
 * So the wording stays: said in the heading, said again under it, and said on
 * every row through "saved here".
 */
export default function AdminDrafts() {
  const { genreLabel } = useTaxonomy();
  const [drafts, setDrafts] = useState<StoredDraft[]>([]);
  const reduced = useReducedMotion();

  // Ref callback, not an effect: this route is prerendered, so reading storage
  // during the first client pass would disagree with the HTML being hydrated.
  const load = useCallback((node: HTMLDivElement | null) => {
    if (node) setDrafts(listDrafts());
  }, []);

  const remove = (record: StoredDraft) => {
    discardDraft(record.story.id);
    setDrafts((list) => list.filter((d) => d.story.id !== record.story.id));

    // Undo restores the record verbatim, timestamp included — a draft that
    // came back claiming it had just been saved would be a lie about the one
    // fact this page exists to report.
    notify.undo(`“${record.story.title || "Untitled"}” discarded`, () => {
      writeDraft(record.story);
      setDrafts(listDrafts());
    });
  };

  return (
    <div ref={load} className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="rule-label">Content</p>
            <h1 className="font-display desk-title mt-2 font-semibold">Drafts on this device</h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
              The workspace saves as you write, to this browser. Nothing here has reached
              the public site — that arrives with the API. Clearing your browser data
              clears these.
            </p>
          </div>
          <Button as={Link} href={newsroomPath("/stories/new")} size="sm">
            <PenLine className="icon-lean h-4 w-4" aria-hidden />
            New story
          </Button>
        </div>
      </Reveal>

      {/*
          ── Cards, not rows ──────────────────────────────────────────────
          A divided list gave every draft the same one-line silhouette, so a
          piece with 504 words in it and the three that are still only a
          headline were indistinguishable until you read the count. On a
          screen whose entire job is "what have I got half-finished", that is
          the one distinction worth seeing before reading anything.

          Cards also give the word count and the status room to sit apart
          from the title rather than queueing behind it on a single line, and
          the grid puts six drafts on a screen where the list managed five.
      */}
      <div className="mt-8">
        {drafts.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" aria-hidden />}
            title="Nothing saved here yet"
            description="Start a story and it appears here from the first sentence — no save button to remember."
            action={
              <Button as={Link} href={newsroomPath("/stories/new")} variant="outline" size="sm">
                Start writing
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {drafts.map((record, i) => {
                const words = draftWordCount(record.story);
                return (
                  <motion.li
                    key={record.story.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        ...transitions.normal,
                        delay: Math.min(i, 8) * stagger.tight,
                      },
                    }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                    transition={transitions.normal}
                    className="surface surface-hover group relative flex min-h-[9.5rem] flex-col p-4"
                  >
                    {/* The whole card is the target, so the link stretches
                        across it rather than wrapping only the text — which
                        would leave the padding and the space under a short
                        headline dead to a click on a card that is mostly
                        space. */}
                    <Link
                      href={
                        record.story.id === "new"
                          ? newsroomPath("/stories/new")
                          : newsroomPath(`/stories/${record.story.id}`)
                      }
                      className="focus-ring min-w-0"
                    >
                      <span className="absolute inset-0" aria-hidden />
                      <p className="line-clamp-2 pr-8 font-semibold leading-snug tracking-tight">
                        {record.story.title || (
                          <span className="text-muted-foreground">Untitled</span>
                        )}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {genreLabel(record.story.genre)}
                      </p>
                    </Link>

                    {/* Pushed to the foot, so every card's metadata sits on
                        one line however far the headline above it ran. */}
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <div className="min-w-0">
                        {/* The count leads, and it is the reason this is a
                            card at all: it tells a draft with a paragraph in
                            it from one that is still only a headline. */}
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {words} {words === 1 ? "word" : "words"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          saved here {formatRelative(record.savedAt)}
                        </p>
                      </div>

                      {/* Same pill vocabulary as the story list. "Ready" rather
                          than "published", for the same reason the button says
                          it: nothing here is published. */}
                      <span
                        className={
                          record.story.status === "published"
                            ? "shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                            : "shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground ring-1 ring-inset ring-border"
                        }
                      >
                        {record.story.status === "published" ? "ready" : record.story.status}
                      </span>
                    </div>

                    {/* Above the stretched link, or it could not be clicked. */}
                    <button
                      type="button"
                      onClick={() => remove(record)}
                      aria-label={`Discard ${record.story.title || "untitled draft"}`}
                      className="focus-ring tap-square absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
