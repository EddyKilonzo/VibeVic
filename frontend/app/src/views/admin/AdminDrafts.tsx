"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, PenLine, Trash2 } from "lucide-react";
import { genreName } from "@/data/content";
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

/**
 * Everything saved on this device and not yet sent anywhere.
 *
 * The workspace has autosaved to `localStorage` since the write became real,
 * but there was no way to see what it had — a store you cannot enumerate is a
 * store you cannot trust, and a writer with three half-finished pieces had to
 * remember all three URLs. This is the list.
 *
 * It is explicitly *this device*. Said in the heading, said again under it,
 * and said on every row through "saved here". There is no server yet, and a
 * page that reads as "my drafts" while meaning "my drafts on this laptop" is
 * the same false promise the save indicator used to make.
 */
export default function AdminDrafts() {
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
            <h1 className="font-display display-2 mt-2 font-semibold">Drafts on this device</h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
              The workspace saves as you write, to this browser. Nothing here has reached
              the public site — that arrives with the API. Clearing your browser data
              clears these.
            </p>
          </div>
          <Button as={Link} href="/admin/stories/new" size="sm">
            <PenLine className="icon-lean h-4 w-4" aria-hidden />
            New story
          </Button>
        </div>
      </Reveal>

      <div className="surface mt-8 overflow-hidden">
        {drafts.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" aria-hidden />}
            title="Nothing saved here yet"
            description="Start a story and it appears in this list from the first sentence — no save button to remember."
            className="border-0"
            action={
              <Button as={Link} href="/admin/stories/new" variant="outline" size="sm">
                Start writing
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
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
                    exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12, height: 0 }}
                    transition={transitions.normal}
                    className="group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50">
                      <Link
                        href={
                          record.story.id === "new"
                            ? "/admin/stories/new"
                            : `/admin/stories/${record.story.id}`
                        }
                        className="focus-ring min-w-0 flex-1"
                      >
                        <p className="truncate font-semibold tracking-tight">
                          {record.story.title || (
                            <span className="text-muted-foreground">Untitled</span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {genreName(record.story.genre)} · {words}{" "}
                          {words === 1 ? "word" : "words"} · saved here{" "}
                          {formatRelative(record.savedAt)}
                        </p>
                      </Link>

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

                      <button
                        type="button"
                        onClick={() => remove(record)}
                        aria-label={`Discard ${record.story.title || "untitled draft"}`}
                        className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
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
