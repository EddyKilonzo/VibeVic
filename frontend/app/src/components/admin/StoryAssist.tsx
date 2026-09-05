"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bot, CalendarClock, Check, Hash, Sigma, Sparkles, X } from "lucide-react";
import type { Block, Story } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";

/**
 * Three things a model can do against this draft, and one rule holding them.
 *
 * ── The rule ─────────────────────────────────────────────────────────────
 * The model proposes; a person commits. Every route behind this panel is
 * read-only — none of them can reach the records API — so a candidate becomes
 * a record only when the writer presses accept, and the write that follows is
 * an ordinary POST from this browser under their own session. That is a
 * structural guarantee rather than a promise in a prompt: there is no code
 * path from a model's output to a row.
 *
 * ── Why these three and not a general assistant ──────────────────────────
 * Each one is a job where a model is genuinely better than a regex and where
 * being wrong is cheap:
 *
 *   * **Filing** proposes a beat and tags. Filing is not reporting — a beat
 *     comes from a closed list the newsroom already defined — so a wrong
 *     answer costs a dropdown correction, not a false sentence.
 *   * **Sequence** reads the events the draft already describes back out as
 *     candidate timeline rows, so the reporting record is captured as a
 *     by-product of writing rather than as the second job that never happens.
 *   * **Figures** checks every number against the evidence, quotes and
 *     sources filed for *this* piece. It never consults the world: a figure
 *     it cannot find is reported as absent from the records, never as wrong.
 *
 * ── Asked for, never volunteered ─────────────────────────────────────────
 * The panel is collapsed and each section has its own button, for the reason
 * `WritingCoach` gives about the editor's read: a machine that starts talking
 * over a half-written paragraph is a critic reading over the shoulder. It
 * also means one draft never costs three model calls unless the writer wanted
 * three answers.
 */

export function StoryAssist({
  draft,
  storyId,
  onFile,
}: {
  draft: Story;
  /** Null until the piece has been filed once; figures needs a record to read against. */
  storyId: string | null;
  /** Applies a proposed beat and tags to the draft in the editor. Never saves. */
  onFile: (filing: { beat: string; tags: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  return (
    <section className="surface mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 p-5 text-left transition-colors duration-normal hover:bg-secondary/50"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Proposals</span>
          <span className="block text-[12px] text-muted-foreground">
            Filing, the sequence in the piece, and every figure against your records. Nothing is
            saved until you say so.
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
            <div className="space-y-7 border-t border-border p-5">
              <Filing draft={draft} onFile={onFile} />
              <Sequence draft={draft} storyId={storyId} />
              <Figures draft={draft} storyId={storyId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ── The shell each section shares ───────────────────────────────────── */

function Section({
  icon,
  title,
  blurb,
  action,
  error,
  children,
}: {
  icon: ReactNode;
  title: string;
  blurb: string;
  action: ReactNode;
  error: string | null;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
            {icon}
            {title}
          </h3>
          <p className="mt-1 max-w-[62ch] text-[11px] leading-snug text-muted-foreground">
            {blurb}
          </p>
        </div>
        {action}
      </div>

      {/* The route's own sentence, forwarded. It names the setting to change
          or says the queue is busy — both actionable, unlike "went wrong". */}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3.5 text-[13px] leading-relaxed text-muted-foreground">
          {error}
        </p>
      )}

      {children}
    </div>
  );
}

/** Provenance, stated before the content and not as a footnote. */
function FromAModel() {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
      <Bot className="h-3 w-3" aria-hidden />
      Proposed by a model — nothing is saved until you accept it
    </p>
  );
}

/** Turns the block array into the plain text every assist route expects. */
function plainText(body: Block[]): string {
  return body
    .map((block) => {
      switch (block.type) {
        case "paragraph":
        case "heading":
        case "quote":
          return block.text;
        case "list":
          return block.items.join("\n");
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

async function ask<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The newsroom returned ${response.status}.`);
  }
  return (await response.json()) as T;
}

/* ── Filing ──────────────────────────────────────────────────────────── */

function Filing({
  draft,
  onFile,
}: {
  draft: Story;
  onFile: (filing: { beat: string; tags: string[] }) => void;
}) {
  const [result, setResult] = useState<{ beat: string; why: string; tags: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setApplied(false);
    try {
      setResult(
        await ask("/api/newsroom/assist/filing", {
          title: draft.title,
          dek: draft.dek,
          body: plainText(draft.body),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the newsroom.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      icon={<Hash className="h-4 w-4 text-accent" aria-hidden />}
      title="Where this is filed"
      blurb="A beat from your own list, and tags for finding this again. Applying puts them in the fields above; it does not save."
      error={error}
      action={
        <Button size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Reading…" : result ? "Again" : "Suggest"}
        </Button>
      }
    >
      {result && (
        <div className="mt-4 space-y-3">
          <FromAModel />
          <div className="rounded-lg border border-border bg-background p-3.5">
            <p className="text-[13px] text-foreground">
              Beat: <span className="font-semibold">{result.beat}</span>
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{result.why}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3.5">
              <Button
                size="sm"
                variant={applied ? "outline" : "primary"}
                disabled={applied}
                onClick={() => {
                  onFile({ beat: result.beat, tags: result.tags });
                  setApplied(true);
                  notify.success(
                    "Filing applied to the draft",
                    "It saves with everything else — change it above if it is wrong.",
                  );
                }}
              >
                {applied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Applied
                  </>
                ) : (
                  "Apply to the draft"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── Sequence ────────────────────────────────────────────────────────── */

interface Event {
  occurredAt: string;
  precision: "day" | "month" | "year";
  what: string;
  quote: string;
}

function Sequence({ draft, storyId }: { draft: Story; storyId: string | null }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState<Record<number, "kept" | "dropped">>({});

  const run = async () => {
    setBusy(true);
    setError(null);
    setSettled({});
    try {
      const result = await ask<{ events: Event[] }>("/api/newsroom/assist/timeline", {
        title: draft.title,
        body: plainText(draft.body),
      });
      setEvents(result.events);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the newsroom.");
    } finally {
      setBusy(false);
    }
  };

  const keep = async (event: Event, index: number) => {
    if (!storyId) {
      notify.error(
        "This piece has no record yet",
        "Let it save once — a timeline event has to be filed against something.",
      );
      return;
    }
    try {
      const response = await fetch("/api/newsroom/records/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurredAt: event.occurredAt,
          what: event.what,
          storyIds: [storyId],
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The newsroom returned ${response.status}.`);
      }
      setSettled((prev) => ({ ...prev, [index]: "kept" }));
      notify.success("Filed to the timeline", "It is in the reporting record for this piece now.");
    } catch (cause) {
      notify.error(
        "Not filed",
        cause instanceof Error ? cause.message : "Could not reach the newsroom.",
      );
    }
  };

  return (
    <Section
      icon={<CalendarClock className="h-4 w-4 text-accent" aria-hidden />}
      title="The sequence in the piece"
      blurb="Events the draft already describes, read back out as timeline entries. Each one quotes the sentence it came from."
      error={error}
      action={
        <Button size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Reading…" : events ? "Again" : "Find events"}
        </Button>
      }
    >
      {events && events.length === 0 && (
        <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
          No dated events found. A sequence needs dates in the text — an event the draft does not
          date is deliberately not proposed, because a timeline entry without a date is not one.
        </p>
      )}

      {events && events.length > 0 && (
        <div className="mt-4 space-y-3">
          <FromAModel />
          <ul className="space-y-2.5">
            {events.map((event, index) => {
              const state = settled[index];
              return (
                <li
                  key={index}
                  className={
                    state
                      ? "rounded-lg border border-border bg-secondary/40 p-3.5 opacity-60"
                      : "rounded-lg border border-border bg-background p-3.5"
                  }
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {when(event)}
                    </span>
                    {event.precision !== "day" && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {event.precision} only
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-foreground">
                    {event.what}
                  </p>
                  {/* The sentence it came from, so the check is against the
                      draft rather than against the model's confidence. */}
                  <p className="mt-1.5 max-w-[68ch] border-l-2 border-border pl-3 text-[12px] italic leading-relaxed text-muted-foreground">
                    {event.quote}
                  </p>

                  {state ? (
                    <p className="mt-2.5 text-[12px] font-semibold text-muted-foreground">
                      {state === "kept" ? "Filed to the timeline" : "Dismissed"}
                    </p>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => void keep(event, index)}>
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        File it
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSettled((prev) => ({ ...prev, [index]: "dropped" }))}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Not this
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}

/**
 * A date shown only as precisely as the draft actually fixed it.
 *
 * The API stores an instant because the column is a timestamp, but printing a
 * day for an event the piece dated to "January" would be the interface
 * inventing a fact the model was careful not to.
 */
function when(event: Event): string {
  const date = new Date(event.occurredAt);
  if (Number.isNaN(date.getTime())) return event.occurredAt;
  if (event.precision === "year") return String(date.getUTCFullYear());
  if (event.precision === "month") {
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ── Figures ─────────────────────────────────────────────────────────── */

interface Figure {
  figure: string;
  sentence: string;
  found: boolean;
  record?: string;
  note: string;
}

function Figures({ draft, storyId }: { draft: Story; storyId: string | null }) {
  const [result, setResult] = useState<{
    figures: Figure[];
    recordsChecked: number;
    unreadable: string[];
    note?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await ask("/api/newsroom/assist/figures", {
          storyId,
          body: plainText(draft.body),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the newsroom.");
    } finally {
      setBusy(false);
    }
  };

  const unmatched = result?.figures.filter((figure) => !figure.found) ?? [];

  return (
    <Section
      icon={<Sigma className="h-4 w-4 text-accent" aria-hidden />}
      title="Figures against your records"
      blurb="Every number in the draft, checked against the evidence, quotes and sources filed for this piece. It checks your filing cabinet, never the world."
      error={error}
      action={
        <Button size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Checking…" : result ? "Again" : "Check figures"}
        </Button>
      }
    >
      {result?.note && (
        <p className="mt-4 max-w-[62ch] rounded-lg border border-border bg-secondary/40 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
          {result.note}
        </p>
      )}

      {result && result.figures.length > 0 && (
        <div className="mt-4 space-y-3">
          <FromAModel />
          <p className="text-[12px] text-muted-foreground">
            {result.figures.length} figure{result.figures.length === 1 ? "" : "s"} found,{" "}
            {unmatched.length} not in the {result.recordsChecked} record
            {result.recordsChecked === 1 ? "" : "s"} filed here.
            {result.unreadable.length > 0 && ` Could not read: ${result.unreadable.join(", ")}.`}
          </p>

          <ul className="space-y-2.5">
            {result.figures.map((figure, index) => (
              <li
                key={index}
                className={
                  figure.found
                    ? "rounded-lg border border-border bg-background p-3.5"
                    : "rounded-lg border border-accent/40 bg-accent/[0.05] p-3.5"
                }
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-[15px] font-semibold text-primary">
                    {figure.figure}
                  </span>
                  <span
                    className={
                      figure.found
                        ? "rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                        : "rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-primary"
                    }
                  >
                    {figure.found ? "in your records" : "not in your records"}
                  </span>
                </div>
                <p className="mt-1.5 max-w-[68ch] border-l-2 border-border pl-3 text-[12px] italic leading-relaxed text-muted-foreground">
                  {figure.sentence}
                </p>
                <p className="mt-1.5 max-w-[68ch] text-[12px] leading-relaxed text-muted-foreground">
                  {figure.note}
                </p>
              </li>
            ))}
          </ul>

          {/* Said once, at the bottom, rather than on every unmatched row.
              "Not in your records" is a fact about the filing cabinet, and a
              reader of this panel must not come away thinking it means the
              number is wrong. */}
          {unmatched.length > 0 && (
            <p className="max-w-[68ch] text-[11px] leading-relaxed text-muted-foreground">
              Not in your records means nobody has filed the evidence, quote or source behind that
              figure here yet. It is not a claim that the figure is wrong — this check has never
              seen anything but your own records.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
