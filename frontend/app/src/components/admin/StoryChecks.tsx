"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, ChevronDown, CircleDashed, Eye, Minus } from "lucide-react";
import type { Story } from "@/data/types";
import { prePublicationChecklist, reviewStory } from "@/lib/intelligence/checks";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import type { ChecklistItem, Finding } from "@/lib/intelligence/types";
import { useCuration, useNewsroom } from "@/data/newsroom/useNewsroom";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";

/**
 * The editorial checks, on the draft they are about.
 *
 * ── Why they belong here and nowhere else ────────────────────────────────
 * `lib/intelligence` has been finished and unreachable: a set of
 * deterministic checks — repeated phrases, figures with nobody attached to
 * them, sentences that contradict each other, images with no alt text — that
 * nothing in the product ever ran. A check a writer cannot see is a check
 * that does not exist, so it now sits under the editor, reading the live
 * draft.
 *
 * ── What it will not do ──────────────────────────────────────────────────
 * It does not rewrite a sentence, score the piece out of ten, or assert any
 * fact the draft does not already contain. Every finding names the exact text
 * behind it and says why it is worth a look, and the checklist answers
 * "unknown" out loud rather than rounding it to a pass. The same draft always
 * produces the same output, which is the property that makes it trustworthy:
 * nothing here is a model's opinion.
 *
 * ── Collapsed by default ─────────────────────────────────────────────────
 * A panel of observations open over somebody's half-written first paragraph
 * is a critic reading over their shoulder. It counts what it found on the
 * closed header, and opens when the writer is ready to be edited.
 */
export function StoryChecks({ draft }: { draft: Story }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  /**
   * Three collections, named so only three are fetched.
   *
   * The checks read entities to spot inconsistent terminology, and count the
   * sources and quotes linked to this piece. Nothing here needs ideas,
   * deadlines or the timeline, and asking for the whole workspace to run a
   * spell-check on terminology would fetch every interview note in the
   * newsroom to render a panel that is collapsed by default.
   *
   * The loading state is deliberately not surfaced. These are observations
   * about a draft, not the draft itself: a checklist that flashed "0 sources"
   * into a spinner and back would be reporting on its own network state, and
   * the counts settle a moment later without anyone waiting on them.
   */
  const {
    newsroom: { entities, sources, quotes },
  } = useNewsroom("entities", "sources", "quotes");

  /**
   * House style, which is not a collection and so cannot be named above.
   *
   * `StyleGuideEntry` — preferred term, terms to avoid, why — has been in the
   * schema and on the curation route since the newsroom was built, and nothing
   * had ever read one. It is read here because this is the only screen where
   * a style rule can do any work: a guide nobody is shown while writing is a
   * document, and a document is not a check.
   *
   * The loading state is not surfaced, for the same reason the counts above
   * are not. An empty guide produces no findings, which is indistinguishable
   * from a guide that has not arrived yet — and the honest difference is a
   * moment, not a spinner.
   */
  const { styleGuide } = useCuration();

  /**
   * The checks run on a settled draft, not on every keystroke.
   *
   * `findRepetition` walks every four-word window in the piece and
   * `findContradictions` compares sentences pairwise — cheap once, wasteful
   * sixty times a second while somebody is typing a paragraph. Waiting for a
   * pause costs nothing a writer can perceive: these are observations to read
   * back, not a live counter. The delay is deliberately longer than the
   * autosave's, so the checks never run before the words are safe.
   */
  const [settled, setSettled] = useState(draft);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(draft), 1500);
    return () => window.clearTimeout(timer);
  }, [draft]);

  // Linked by story id, so the checklist reports this piece's reporting
  // rather than the workspace's total.
  const sourceCount = useMemo(
    () => sources.filter((s) => s.storyIds.includes(draft.id)).length,
    [sources, draft.id],
  );
  const quoteCount = useMemo(
    () => quotes.filter((q) => q.storyIds.includes(draft.id)).length,
    [quotes, draft.id],
  );

  const findings = useMemo(
    () => reviewStory(settled, entities, styleGuide),
    [settled, entities, styleGuide],
  );
  const { genreLabel } = useTaxonomy();
  const checklist = useMemo(
    () =>
      prePublicationChecklist(settled, {
        sourceCount,
        quoteCount,
        beatLabel: genreLabel(settled.genre),
      }),
    [settled, sourceCount, quoteCount, genreLabel],
  );

  const attention = findings.filter((f) => f.severity === "attention").length;
  const unmet = checklist.filter((c) => c.state === "unmet").length;

  return (
    <section className="surface mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 p-5 text-left transition-colors duration-normal hover:bg-secondary/50"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Eye className="h-[18px] w-[18px]" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="font-display block text-base font-semibold tracking-tight">
            Read it back
          </span>
          {/* The summary line is the whole point of the closed state: it has
              to say what is inside without the writer having to open it. */}
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {attention === 0 && unmet === 0
              ? `${findings.length} ${findings.length === 1 ? "note" : "notes"} · nothing outstanding on the checklist`
              : [
                  attention > 0 && `${attention} to look at`,
                  unmet > 0 && `${unmet} not done yet`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-normal",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className="grid gap-6 border-t border-border p-5 lg:grid-cols-2">
              <div>
                <p className="rule-label">Before it goes out</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Answered from the draft itself. There is no overall score — a number would
                  compress &ldquo;no headline&rdquo; and &ldquo;no sources&rdquo; into one
                  figure that means neither.
                </p>
                <ul className="mt-4 space-y-3">
                  {checklist.map((item) => (
                    <ChecklistRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>

              <div>
                <p className="rule-label">What reading it turned up</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Observations, never edits. Each one names the text behind it so you can go
                  and look.
                </p>

                {findings.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Nothing to raise. The checks look for repeated phrases, unattributed
                    figures, sentences that disagree, missing alt text and structure — none of
                    them fired on this draft.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {findings.map((finding) => (
                      <FindingRow key={finding.id} finding={finding} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * One checklist answer.
 *
 * Three states, three marks — met, unmet and unknown — separated by shape as
 * well as colour. "Unknown" gets its own mark rather than borrowing the
 * unmet one, because "no images in this piece" and "images with no alt text"
 * are not the same answer and must not look like it.
 */
function ChecklistRow({ item }: { item: ChecklistItem }) {
  const Icon = item.state === "met" ? Check : item.state === "unmet" ? Minus : CircleDashed;

  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          item.state === "met"
            ? "bg-primary text-primary-foreground"
            : item.state === "unmet"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">
          {item.label}
          <span className="sr-only">
            {item.state === "met" ? " — done" : item.state === "unmet" ? " — not done" : " — unknown"}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {item.because}
        </span>
      </span>
    </li>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const attention = finding.severity === "attention";

  return (
    <li
      className={cn(
        "rounded-lg border p-3.5",
        attention ? "border-accent/35 bg-accent/[0.06]" : "border-border",
      )}
    >
      <p className="flex items-start gap-2 text-sm font-semibold leading-snug">
        {attention && (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        )}
        <span className="min-w-0">{finding.title}</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.detail}</p>
      {finding.evidence && (
        <p className="mt-2 truncate rounded bg-secondary px-2 py-1 text-[11px] text-foreground">
          {finding.evidence}
        </p>
      )}
    </li>
  );
}
