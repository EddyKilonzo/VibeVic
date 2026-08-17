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
        className="surface-compact mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 p-3 pl-4"
      >
        <BookOpenCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />

        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          You were <span className="font-semibold text-foreground">{Math.round(progress * 100)}%</span>{" "}
          through this piece.
        </p>

        <button
          type="button"
          onClick={resume}
          className="focus-ring press tap inline-flex items-center rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Pick up there
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Start from the beginning"
          className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
