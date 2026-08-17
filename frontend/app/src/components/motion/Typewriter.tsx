"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { viewport } from "@/lib/motion";

/**
 * Types a line out, and does it again every time you scroll back to it.
 *
 * ── The layout does not move ─────────────────────────────────────────────
 * The obvious implementation renders `text.slice(0, n)` and lets the box grow.
 * On a pull quote that is three lines of reflow per pass: the block gets
 * taller as the words arrive, and everything beneath it slides down while the
 * reader is watching. So the full text is always in the flow, invisible, and
 * the typed portion is painted over it. The box is its final size from the
 * first frame and nothing below it ever moves.
 *
 * That invisible copy is also the accessible one. It carries the whole
 * quotation, so assistive technology reads the sentence rather than whatever
 * fragment the animation happens to be on; the overlay is `aria-hidden`.
 *
 * Under reduced motion it renders as ordinary text with no caret and no timer.
 */
export function Typewriter({
  text,
  className,
  /** Milliseconds per character. */
  speed = 26,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  // Not `once` — this replays, matching every other reveal on the site.
  const inView = useInView(ref, { margin: viewport.margin, amount: viewport.amount });

  const [count, setCount] = useState(0);

  // Reset on the way out, adjusted during render rather than in an effect: by
  // the time an effect ran, a frame of the finished line would already have
  // painted at the top of the next pass.
  const [wasInView, setWasInView] = useState(inView);
  if (inView !== wasInView) {
    setWasInView(inView);
    if (!inView) setCount(0);
  }

  useEffect(() => {
    if (!inView || reduced) return;

    let typed = 0;
    const timer = window.setInterval(() => {
      typed += 1;
      setCount(typed);
      if (typed >= text.length) window.clearInterval(timer);
    }, speed);

    return () => window.clearInterval(timer);
  }, [inView, reduced, text, speed]);

  if (reduced) {
    return (
      <span ref={ref} className={className}>
        {text}
      </span>
    );
  }

  const done = count >= text.length;

  return (
    <span ref={ref} className={cn("relative block", className)}>
      {/* Holds the box at its final size, and is what gets read aloud. */}
      <span className="invisible">{text}</span>

      <span aria-hidden className="absolute inset-0">
        {text.slice(0, count)}
        <span
          className={cn(
            "ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.08em] bg-accent align-middle",
            // The caret blinks while there is more to come and leaves once the
            // line is finished — a cursor parked on a completed sentence reads
            // as an unsaved edit rather than as punctuation.
            // `caret-blink` is already registered in the Tailwind config for
            // the editor's cursor; reusing it keeps one blink rate on the site.
            done ? "opacity-0" : "animate-caret-blink",
          )}
        />
      </span>
    </span>
  );
}
