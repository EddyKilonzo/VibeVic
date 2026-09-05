"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bot, PenLine, Sparkles } from "lucide-react";
import type { Block, Story } from "@/data/types";
import { craftTips, type Tip } from "@/lib/intelligence/craft";
import { useCuration } from "@/data/newsroom/useNewsroom";
import { Button } from "@/components/ui/Button";
import { transitions } from "@/lib/motion";

/**
 * Advice about the writing, in two halves that are never mixed up.
 *
 * ── Why the two halves are labelled so differently ───────────────────────
 * The top half is measured. Sentence lengths, paragraph sizes, adverb share,
 * a reading grade — every note names the number behind it and the same draft
 * always produces the same notes. It is free, instant, and cannot be wrong
 * about what it counted.
 *
 * The bottom half is a model reading the piece. It can say the things a
 * measurement cannot — that the third paragraph should be the first, that a
 * reader will ask something the draft never answers — and it can be wrong
 * about any of them.
 *
 * On a site whose premise is that nothing published is invented, those two
 * cannot sit in one undifferentiated list. So they are separated, headed
 * differently, and the model's half is asked for rather than arriving: it
 * costs a request, it takes a few seconds, and it should be a thing the
 * writer decides to hear rather than a critic that starts talking.
 *
 * ── What neither half does ───────────────────────────────────────────────
 * Neither rewrites a word. The measurements point at a paragraph; the read
 * names what is weak and says what direction would fix it. Replacement prose
 * is refused in the model's own schema — it would get pasted in, and then a
 * machine has written part of the article.
 *
 * ── Collapsed, like the checks it sits beside ────────────────────────────
 * `StoryChecks` makes the argument and it applies here twice over: a panel of
 * advice open over somebody's half-written first paragraph is a critic
 * reading over their shoulder.
 */
export function WritingCoach({ draft }: { draft: Story }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  /*
   * Measured on the draft as it stands.
   *
   * Not debounced, unlike `StoryChecks`. These are cheaper — a pass over the
   * words rather than a pairwise sentence comparison — and the panel is
   * closed by default, so the common case is that they are computed once when
   * somebody opens it. `useMemo` on the body is enough.
   */
  const tips = useMemo(() => craftTips(draft), [draft]);

  return (
    <section className="surface mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 p-5 text-left transition-colors duration-normal hover:bg-secondary/50"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-primary">
          <PenLine className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">On the writing</span>
          <span className="block text-[12px] text-muted-foreground">
            {tips.length === 0
              ? "Nothing measurable stands out."
              : `${tips.length} thing${tips.length === 1 ? "" : "s"} worth a look, and an editor's read if you want one.`}
          </span>
        </span>
        <span className="text-[12px] font-semibold text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-5">
              <Measured tips={tips} />
              <EditorsRead draft={draft} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ── The measured half ───────────────────────────────────────────────── */

function Measured({ tips }: { tips: Tip[] }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
          Measured
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Counted from the draft. The same words always give the same notes.
        </p>
      </div>

      {tips.length === 0 ? (
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
          Nothing stands out on length, rhythm, voice or reading level. That is not a verdict on
          the writing — it is the absence of the things that can be counted.
        </p>
      ) : (
        <ul className="mt-3.5 space-y-3">
          {tips.map((tip) => (
            <li key={tip.id} className="rounded-lg border border-border bg-background p-3.5">
              <p className="text-[13px] font-semibold leading-snug text-foreground">{tip.title}</p>
              <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
                {tip.detail}
              </p>
              {tip.evidence && (
                <p className="mt-2 border-l-2 border-accent/40 pl-3 text-[12px] italic leading-snug text-muted-foreground">
                  {tip.evidence.length > 200 ? `${tip.evidence.slice(0, 200)}…` : tip.evidence}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── The model's half ────────────────────────────────────────────────── */

interface Read {
  notes: { about: string; observation: string; consider: string }[];
  unanswered: string[];
  phrasing: { where: string; habit: string; direction: string }[];
  attention: { where: string; why: string }[];
  hold: string;
  strongest: string;
  /** True when the draft was longer than the route reads in one pass. */
  truncated: boolean;
}

function EditorsRead({ draft }: { draft: Story }) {
  // The same source `StoryChecks` reads it from, so the two halves of the
  // coach are held to one style guide rather than to two copies of one.
  const { styleGuide } = useCuration();
  const [read, setRead] = useState<Read | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    setAsking(true);
    setError(null);
    try {
      const response = await fetch("/api/newsroom/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          title: draft.title,
          dek: draft.dek,
          body: plainText(draft.body),
          beat: draft.genre,
          /*
           * The house style guide, which the counted half has always had and
           * this half never did — `findHouseStyle` reads it, the read did not
           * see it, and the read was the half giving advice about wording.
           * Sent as the plain lines rather than the records, because the model
           * needs the rule and not the row.
           */
          styleGuide: styleGuide.map((entry) =>
            [
              `Prefer "${entry.preferred}" over ${entry.avoid.map((term) => `"${term}"`).join(", ")}`,
              entry.why,
            ]
              .filter(Boolean)
              .join(" — "),
          ),
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        // The route's own sentence, forwarded. It names which setting to
        // change, or says the queue is busy — both of which the writer can act
        // on, unlike "something went wrong".
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `The newsroom returned ${response.status}.`);
        return;
      }

      setRead((await response.json()) as Read);
    } catch {
      setError("Could not reach the newsroom. Nothing in your draft has changed.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mt-7 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight text-foreground">
            <Bot className="h-4 w-4 text-accent" aria-hidden />
            An editor&rsquo;s read
          </h3>
          <p className="mt-1 max-w-[62ch] text-[11px] leading-snug text-muted-foreground">
            A model reading the draft once. It can see things a count cannot, and it can be
            wrong about any of them — it never rewrites a sentence and never adds a fact.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void ask()} disabled={asking}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {asking ? "Reading…" : read ? "Read it again" : "Ask for a read"}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3.5 text-[13px] leading-relaxed text-muted-foreground">
          {error}
        </p>
      )}

      {read && (
        <div className="mt-4 space-y-4">
          {/* Provenance first, not as a footnote — the same decision
              `PitchPanel` makes, and for the same reason: on this site machine
              text has to arrive labelled. */}
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <Bot className="h-3 w-3" aria-hidden />
            Suggestion from a model, not a measurement
          </p>

          {/*
              Said out loud at last.

              The route has always capped the body it reads, and the comment
              beside that cap claimed the panel said so — it did not, because
              there was nothing in the response to say it with. A long feature
              got notes on its first two thirds presented as notes on the
              piece, and the one place that is most misleading is the ending,
              which the read never saw. */}
          {read.truncated && (
            <p className="max-w-[68ch] rounded-lg border border-accent/40 bg-accent/[0.05] p-3.5 text-[13px] leading-relaxed text-muted-foreground">
              This piece is longer than one read covers, so the notes are about the earlier part
              of it. Nothing here is a comment on the ending.
            </p>
          )}

          <ul className="space-y-3">
            {read.notes.map((note, index) => (
              <li key={index} className="rounded-lg border border-border bg-background p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {note.about}
                </p>
                <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-foreground">
                  {note.observation}
                </p>
                <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
                  {note.consider}
                </p>
              </li>
            ))}
          </ul>

          {read.unanswered.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                A reader would still ask
              </p>
              <ul className="mt-2 space-y-1.5">
                {read.unanswered.map((question, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-[13px] leading-relaxed text-foreground"
                  >
                    <span className="text-accent" aria-hidden>
                      ·
                    </span>
                    <span className="min-w-0">{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/*
              Phrasing, and the reason there is no "instead" column.

              The schema has nowhere to put a replacement sentence, so one
              cannot arrive — which is the mechanism rather than the promise.
              Each note names the habit, points at the passage and says which
              direction fixes it; the words stay the writer's. */}
          {read.phrasing.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phrasing
              </p>
              <ul className="mt-2.5 space-y-3">
                {read.phrasing.map((note, index) => (
                  <li key={index}>
                    <p className="text-[12px] font-semibold text-foreground">
                      {note.habit}{" "}
                      <span className="font-normal text-muted-foreground">— {note.where}</span>
                    </p>
                    <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
                      {note.direction}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/*
              Where a reader leaves, which is a locatable thing rather than a
              mood. The route is forbidden from giving general advice about
              engagement or suggesting a hook, because that is the note that
              produces hype — so every item here points at a passage and names
              what in the text loses them there. */}
          {read.attention.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Where a reader is most likely to stop
              </p>
              <ul className="mt-2.5 space-y-3">
                {read.attention.map((note, index) => (
                  <li key={index}>
                    <p className="text-[12px] font-semibold text-foreground">{note.where}</p>
                    <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
                      {note.why}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            {read.hold && (
              <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Earns the next paragraph:</span>{" "}
                {read.hold}
              </p>
            )}
            <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Working:</span> {read.strongest}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The draft as prose, for the model.
 *
 * Blocks flattened to text, and only the ones that carry words. Deliberately
 * not the JSON: the block ids, types and image URLs are the editor's business
 * and are noise to a reader — and every token of noise is a token of the
 * budget not spent on the writing.
 *
 * Quotes are marked as quotes, because a note telling somebody to tighten a
 * sentence that turns out to be what a source actually said would be advice
 * to misquote them.
 */
function plainText(body: Block[]): string {
  const out: string[] = [];
  for (const block of body) {
    switch (block.type) {
      case "heading":
        out.push(`## ${block.text}`);
        break;
      case "paragraph":
        out.push(block.text);
        break;
      case "quote":
        out.push(`[quote] ${block.text}`);
        break;
      case "list":
        out.push(block.items.map((item) => `- ${item}`).join("\n"));
        break;
      case "image":
        if (block.caption) out.push(`[caption] ${block.caption}`);
        break;
      case "divider":
        break;
    }
  }
  return out.join("\n\n");
}
