"use client";

import type { RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpenCheck, X } from "lucide-react";
import { transitions } from "@/lib/motion";

/**
 * "You were part-way through this."
 *
 * Shown only when there is a saved position, and it does nothing on its own —
 * see `useReadingPosition` for why the automatic version of this is the one
 * readers resent. Both buttons are real choices: one jumps, the other puts the
 * offer away and lets them start from the top.
 */
export function ResumeReading({
  progress,
  target,
  onDismiss,
}: {
  /** Fraction through the article, 0–1. */
  progress: number;
  target: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();

  const resume = () => {
    const article = target.current;
    if (!article) return;

    // The saved fraction is of the article's own scrollable span, which is the
    // same span the progress bar and the HUD measure — so the reader lands
    // where the ring said they were, not where the whole document was.
    const start = article.offsetTop;
    const span = article.offsetHeight - window.innerHeight;

    window.scrollTo({
      top: start + Math.max(0, span) * progress,
      behavior: reduced ? "auto" : "smooth",
    });
    onDismiss();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={transitions.normal}
        // Stacked, not a single wrapping row. It was one flex line — icon,
        // sentence, "Pick up there", dismiss — which is fine across the top of
        // an article and impossible in the 290px rail it now lives in: the two
        // buttons and the gaps took every pixel, and the sentence was left
        // breaking one word per line down a 60px column.
        //
        // Accent-tinted rather than another white card. It is the one thing in
        // the rail addressed to *this* reader on *this* visit, and it should
        // not look like the permanent furniture around it.
        className="relative overflow-hidden rounded-lg border border-accent/30 bg-accent/[0.07] p-3.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <BookOpenCheck className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-primary">
            Pick up where you left off
          </p>
        </div>

        {/* The figure, shown as well as said. It is a real measurement — the
            reader's own last position in this article — so it gets a bar
            rather than being buried mid-sentence. */}
        <div className="mt-3 flex items-center gap-2.5">
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-accent/20"
            role="img"
            aria-label={`${Math.round(progress * 100)} per cent read`}
          >
            <motion.span
              className="block h-full rounded-full bg-accent"
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ width: `${Math.max(3, progress * 100)}%`, transformOrigin: "left" }}
              transition={transitions.editorial}
            />
          </div>
          <span aria-hidden className="shrink-0 text-[11px] font-semibold tabular-nums text-primary">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={resume}
            className="focus-ring press tap inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-ink-deep"
          >
            Take me there
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Start from the beginning"
            title="Start from the beginning"
            className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/15 hover:text-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
