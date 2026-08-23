"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Sparkles } from "lucide-react";
import { genreLabel } from "@/data/content";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { Button } from "@/components/ui/Button";

/**
 * The pitch desk.
 *
 * ── What this is allowed to be ───────────────────────────────────────────
 * A thinking aid on an idea the journalist has already had, and nothing more.
 * It suggests angles, the kinds of people to call and the questions a piece
 * would have to answer. It writes nothing into the record on its own: every
 * suggestion needs a click to become part of the idea, and the panel says
 * where it came from in the first line, because a site whose premise is that
 * nothing published is invented cannot have machine text arriving unlabelled.
 *
 * ── What it does not do ──────────────────────────────────────────────────
 * Rank. `AdminIdeas` is explicit that priority is typed and never computed,
 * and that holds whether the ranking comes from a formula or a model. The
 * response has no priority field for the UI to render.
 *
 * `difficulty` is not a ranking — it is an estimate of how much work standing
 * the angle up would take, which is a property of the reporting rather than a
 * claim about which story matters.
 */

interface Angle {
  angle: string;
  why: string;
  difficulty: "quick" | "moderate" | "hard";
}

interface Pitch {
  angles: Angle[];
  sources: string[];
  questions: string[];
  beat: string;
  caution: string;
}

const DIFFICULTY_STYLE: Record<Angle["difficulty"], string> = {
  quick: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  moderate: "bg-accent/12 text-primary ring-1 ring-inset ring-accent/35",
  hard: "bg-primary text-primary-foreground",
};

export function PitchDesk({
  idea,
  note,
  onUseAngle,
  onUseBeat,
}: {
  idea: string;
  note: string;
  /** Appends an angle to the journalist's own note. Never replaces it. */
  onUseAngle: (text: string) => void;
  onUseBeat: (slug: string) => void;
}) {
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/newsroom/pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, note }),
      });
      const data = (await response.json()) as Pitch & { error?: string };
      if (!response.ok) {
        setProblem(data.error ?? "That did not work.");
        return;
      }
      setPitch(data);
    } catch {
      setProblem("The request never left the browser. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-border pt-5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={run}
        disabled={!idea.trim() || busy}
        loading={busy}
        loadingText="Working it up"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Work up this idea
      </Button>

      {problem && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-[11px] text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {problem}
        </p>
      )}

      <AnimatePresence>
        {pitch && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transitions.normal}
            className="mt-4 space-y-4"
          >
            {/* Provenance first, not in a footnote. */}
            <p className="rounded-md bg-secondary px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
              Suggested by a model, from your line and nothing else. None of it is reporting, none
              of it is checked, and nothing here is saved until you put it somewhere.
            </p>

            <section>
              <p className="rule-label">Angles</p>
              <ul className="mt-2 space-y-2">
                {pitch.angles.map((angle) => (
                  <li key={angle.angle} className="surface-compact p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold leading-snug">{angle.angle}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                          DIFFICULTY_STYLE[angle.difficulty],
                        )}
                      >
                        {angle.difficulty}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {angle.why}
                    </p>
                    <button
                      type="button"
                      onClick={() => onUseAngle(angle.angle)}
                      className="focus-ring mt-1.5 text-[11px] font-semibold text-primary underline-grow"
                    >
                      Add to the note
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="rule-label">Who to call</p>
              <ul className="mt-2 space-y-1">
                {pitch.sources.map((source) => (
                  <li key={source} className="text-[11px] leading-relaxed text-muted-foreground">
                    — {source}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="rule-label">It has to answer</p>
              <ul className="mt-2 space-y-1">
                {pitch.questions.map((question) => (
                  <li key={question} className="text-[11px] leading-relaxed text-muted-foreground">
                    — {question}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="rule-label">What would make it wrong</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {pitch.caution}
              </p>
            </section>

            <button
              type="button"
              onClick={() => onUseBeat(pitch.beat)}
              className="focus-ring w-full rounded-md border border-dashed border-border px-2.5 py-2 text-[11px] font-semibold transition-colors hover:border-accent/50 hover:text-primary"
            >
              File under {genreLabel(pitch.beat)}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
