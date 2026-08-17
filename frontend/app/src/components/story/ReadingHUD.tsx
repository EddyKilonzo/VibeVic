"use client";

import { useState, type RefObject } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { ArrowUp, List } from "lucide-react";
import type { Story } from "@/data/types";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";

/** Appears once the reader has committed; leaves once they are basically done. */
const SHOW_FROM = 0.04;
const SHOW_UNTIL = 0.985;

/**
 * The reading heads-up display.
 *
 * Four questions a reader half-way down a long piece actually asks, answered
 * in one control at the bottom of the screen:
 *
 *   how far in am I     the ring
 *   how much is left    minutes, not a percentage — "62%" tells you nothing
 *                       about whether you have time before your stop
 *   where am I          the section heading, live, from the scroll spy
 *   how do I get out    the section list, and back to the top
 *
 * It is deliberately not a progress *bar*: the 2px bar under the header
 * already does that job, and repeating it larger would be decoration. This is
 * the readout the bar cannot give.
 *
 * It reports progress upward on the way past, which is what feeds the
 * resume-where-you-left-off mark — recorded into a ref by the caller, so the
 * ~100 renders this component does over a whole article are the only cost.
 */
export function ReadingHUD({
  target,
  story,
  sectionLabel,
  onOpenSections,
  onProgress,
  className,
}: {
  target: RefObject<HTMLElement | null>;
  story: Story;
  /** The heading the reader is under, or null before the first one. */
  sectionLabel: string | null;
  onOpenSections?: () => void;
  onProgress?: (progress: number) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: target as RefObject<HTMLElement>,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    onProgress?.(value);
    // Whole percents only. The readout below cannot show more precision than
    // that, so re-rendering for anything finer is work with no output.
    const next = Math.round(value * 100) / 100;
    setProgress((current) => (current === next ? current : next));
  });

  const visible = progress > SHOW_FROM && progress < SHOW_UNTIL;
  const minutesLeft = Math.max(1, Math.ceil(story.readingMinutes * (1 - progress)));

  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: reduced ? "auto" : "smooth",
    });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={transitions.normal}
          // Bottom right, not bottom centre. Centred, it sat directly under
          // the measure and the reader's eye kept catching it at the end of
          // every line; against the right edge it is out of the reading path
          // and still inside thumb reach on a phone.
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 sm:px-6",
            className,
          )}
        >
          {/* Heavier on a phone. `.frost` is a backdrop blur over whatever is
              behind it, and behind it on a narrow screen is the article — so
              the readout ended up sitting on words, which is the one thing a
              readout must not do. Below `sm` it takes a near-solid card
              instead and lets the blur go. */}
          <div className="frost pointer-events-auto flex max-w-full items-center gap-3 rounded-full border-border bg-card py-1.5 pl-2.5 pr-1.5 shadow-primary sm:bg-transparent">
            <ProgressRing value={progress} />

            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight tabular-nums">
                {minutesLeft} min left
              </p>
              {sectionLabel && (
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {sectionLabel}
                </p>
              )}
            </div>

            {onOpenSections && (
              <button
                type="button"
                onClick={onOpenSections}
                aria-label="Sections in this story"
                className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              >
                <List className="h-4 w-4" aria-hidden />
              </button>
            )}

            <button
              type="button"
              onClick={toTop}
              aria-label="Back to the top"
              className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* The number, for anyone who cannot see the ring. Polite, so it is
              not announced on every scroll — a screen reader user gets it when
              they land on the control, not continuously. */}
          <span className="sr-only" aria-live="polite">
            {Math.round(progress * 100)} percent read, about {minutesLeft} minutes left
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * A 28px ring. Drawn with `stroke-dashoffset` on a rotated circle rather than
 * with a conic gradient, because a gradient cannot be given a round cap and
 * the flat edge is exactly what makes a small progress ring look unfinished.
 */
function ProgressRing({ value }: { value: number }) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0 -rotate-90" aria-hidden focusable="false">
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-border"
      />
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, value)))}
        className="text-accent transition-[stroke-dashoffset] duration-normal ease-out"
      />
    </svg>
  );
}
