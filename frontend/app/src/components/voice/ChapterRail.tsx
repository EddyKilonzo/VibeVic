"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { formatDuration } from "@/lib/format";
import { useVoice } from "@/context/VoiceProvider";

/**
 * Chapters, derived from the article's own headings.
 *
 * There is no separate chapter authoring step: `extractArticle` turns every
 * H2 into a chapter, so a writer structuring their piece well gets a usable
 * audio table of contents for free.
 */
export function ChapterRail({ open }: { open: boolean }) {
  const { article, chapterIndex, seekToChapter, preferences } = useVoice();
  const reduced = useReducedMotion();

  if (!article || article.chapters.length < 2) return null;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={transitions.normal}
          className="overflow-hidden"
        >
          <div className="surface-compact mt-3 p-2">
            <p className="rule-label px-3 py-2">Chapters</p>
            <ol>
              {article.chapters.map((chapter, i) => {
                const active = chapter.index === chapterIndex;
                return (
                  <motion.li
                    key={chapter.index}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...transitions.normal,
                      delay: reduced ? 0 : i * stagger.tight,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => seekToChapter(chapter.index)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "focus-ring group flex w-full items-baseline gap-3 rounded px-3 py-2.5 text-left transition-colors duration-fast hover:bg-secondary",
                        active && "bg-secondary",
                      )}
                    >
                      <span
                        className={cn(
                          "w-6 shrink-0 text-[11px] font-semibold tabular-nums",
                          active ? "text-accent" : "text-muted-foreground",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          active ? "font-semibold text-primary" : "text-foreground",
                        )}
                      >
                        {chapter.title}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatDuration(chapter.seconds / preferences.rate)}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
