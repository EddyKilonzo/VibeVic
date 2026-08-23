"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, ArrowRight, Bot, PhoneCall, Tag, X } from "lucide-react";
import { genreLabel } from "@/data/content";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import type { PitchAngle, PitchResult } from "./pitch";

/**
 * A worked-up idea, in the column that has room for it.
 *
 * ── Where this sits, and why it moved ────────────────────────────────────
 * Under the ideas list, in the main column — not beneath the button that
 * asked for it. The form column is 360px because the ideas are the subject of
 * this screen and the form is an aside to them; three angles, five sources
 * and four questions stacked into that strip was a column of fragments. Here
 * the two short lists sit side by side, the angles get a full measure, and
 * the whole thing reads at a glance.
 *
 * ── What it is careful about ─────────────────────────────────────────────
 * Provenance is the first thing in the panel, not a footnote: on a site whose
 * premise is that nothing published is invented, machine text has to arrive
 * labelled. Nothing here writes itself anywhere — an angle enters the note
 * when it is clicked, the beat changes when the beat button is pressed, and
 * the panel is dismissible without touching either.
 */

const DIFFICULTY_STYLE: Record<PitchAngle["difficulty"], string> = {
  quick: "bg-primary text-primary-foreground",
  moderate: "bg-accent/12 text-primary ring-1 ring-inset ring-accent/35",
  hard: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

export function PitchPanel({
  result,
  onUseAngle,
  onUseBeat,
  onDismiss,
}: {
  result: PitchResult;
  onUseAngle: (text: string) => void;
  onUseBeat: (slug: string) => void;
  onDismiss: () => void;
}) {
  const { pitch, subject } = result;
  const [used, setUsed] = useState<string[]>([]);
  const reduced = useReducedMotion();
  const step = reduced ? 0 : stagger.tight;

  return (
    <motion.section
      aria-label="Worked-up idea"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.normal}
      className="surface mt-5 overflow-hidden"
    >
      <header className="honeycomb honeycomb-strong flex items-start justify-between gap-4 border-b border-border bg-secondary/40 p-5">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Bot className="h-3 w-3 text-accent" aria-hidden />
            Machine suggestion
          </p>
          <h2 className="font-display mt-2 text-lg font-semibold leading-snug tracking-tight text-balance">
            “{subject}”
          </h2>
          <p className="mt-1.5 max-w-[62ch] text-[11px] leading-relaxed text-muted-foreground">
            Angles and questions, generated from that line and nothing else. None of it is
            reporting, none of it is checked, and nothing here reaches the idea until you put it
            there.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss suggestions"
          className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="p-5">
        <p className="rule-label">Angles</p>
        <ul className="mt-3 space-y-2.5">
          {pitch.angles.map((angle, i) => {
            const taken = used.includes(angle.angle);
            return (
              <motion.li
                key={angle.angle}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitions.normal, delay: i * step }}
                className="group/angle relative rounded-lg border border-border bg-background p-3.5 pl-11 transition-colors hover:border-accent/40"
              >
                {/* The number anchors the eye in a stack of near-identical
                    cards, and gives the writer something to refer to. */}
                <span
                  aria-hidden
                  className="font-display absolute left-3.5 top-3.5 text-sm font-semibold tabular-nums text-accent"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <p className="font-display min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight">
                    {angle.angle}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                      DIFFICULTY_STYLE[angle.difficulty],
                    )}
                  >
                    {angle.difficulty}
                  </span>
                </div>

                <p className="mt-1.5 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
                  {angle.why}
                </p>

                <button
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    onUseAngle(angle.angle);
                    setUsed((current) => [...current, angle.angle]);
                  }}
                  className={cn(
                    "focus-ring mt-2.5 inline-flex items-center gap-1 text-xs font-semibold transition-colors",
                    taken ? "cursor-default text-muted-foreground" : "text-primary hover:text-accent",
                  )}
                >
                  {taken ? "In your note" : "Add to the note"}
                  {!taken && <ArrowRight className="nudge-x h-3 w-3" aria-hidden />}
                </button>
              </motion.li>
            );
          })}
        </ul>

        {/* Side by side from `sm` up: two short lists that are read against
            each other — who you would ask, and what you would be asking. */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section>
            <p className="rule-label inline-flex items-center gap-1.5">
              <PhoneCall className="h-3 w-3" aria-hidden />
              Who to call
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {pitch.sources.map((source) => (
                <li
                  key={source}
                  className="rounded-full border border-border px-3 py-1 text-xs leading-snug text-muted-foreground"
                >
                  {source}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="rule-label">It has to answer</p>
            <ol className="mt-3 space-y-2">
              {pitch.questions.map((question, i) => (
                <li key={question} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
                  <span aria-hidden className="shrink-0 font-semibold tabular-nums text-accent">
                    {i + 1}.
                  </span>
                  {question}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* The one section that is not a suggestion to act on, so it does not
            look like one. */}
        <section className="mt-6 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3.5">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
            <AlertCircle className="h-3 w-3" aria-hidden />
            What would make it wrong
          </p>
          <p className="mt-1.5 max-w-[72ch] text-xs leading-relaxed text-muted-foreground">
            {pitch.caution}
          </p>
        </section>

        <button
          type="button"
          onClick={() => onUseBeat(pitch.beat)}
          className="focus-ring surface-compact mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-colors hover:border-accent/50 hover:text-primary"
        >
          <Tag className="h-3.5 w-3.5" aria-hidden />
          File under {genreLabel(pitch.beat)}
        </button>
      </div>
    </motion.section>
  );
}
