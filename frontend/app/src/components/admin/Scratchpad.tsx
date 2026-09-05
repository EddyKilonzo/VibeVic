"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";

/**
 * The scratchpad — one document, on every screen that shows it.
 *
 * ── What it is for, and why it is not a note ─────────────────────────────
 * Notes are records. They have titles, they attach to a piece, they carry a
 * visibility, and a journalist files one on purpose. This is the place
 * thinking goes *before* any of that is true: a number to check, a name half
 * remembered, the sentence that will not come out right, the thing somebody
 * said on the phone that is not yet a quote.
 *
 * That is why there is no title, no save button, and nothing to attach it to.
 * Every one of those is a small decision, and a pad that asks for three
 * decisions before it accepts a word is a pad nobody opens twice.
 *
 * ── One pad rather than one per piece ────────────────────────────────────
 * The same text on the ideas screen and inside a story, because the thought
 * that arrives while writing one piece is very often about another — and a
 * per-piece pad would file it under whichever page happened to be open when
 * it turned up. Material that has settled enough to belong to a piece has a
 * home already: notes, sources, the timeline.
 *
 * ── Closed by default, and it says whether there is anything in it ───────
 * It sits shut like `StoryHistory` and the pre-publication checks, so it never
 * takes space from the editor. The summary line carries the line count, which
 * is the one thing worth knowing without opening it: whether there is anything
 * in there to come back to.
 */

/** Long enough that a pause is a pause, short enough to survive a closed tab. */
const SAVE_AFTER_MS = 900;

type Status = "idle" | "saving" | "saved" | "failed";

export function Scratchpad() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  /*
   * The last text the server has confirmed.
   *
   * Autosave compares against this rather than against a dirty flag, so a save
   * that fails leaves the pad *known* to be unsaved and the next keystroke
   * tries again. A boolean would have been cleared by the attempt.
   */
  const saved = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Read the pad once, on first open rather than on mount: every screen that
     mounts this would otherwise fetch a document most visits never look at. */
  const load = useCallback(async () => {
    if (text !== null) return;
    try {
      const response = await fetch("/api/newsroom/curation/scratchpad", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const row = (await response.json()) as { body?: string };
      const body = row.body ?? "";
      saved.current = body;
      setText(body);
    } catch {
      setError("Could not read the scratchpad.");
      setText("");
    }
  }, [text]);

  const save = useCallback(async (next: string) => {
    setStatus("saving");
    try {
      const response = await fetch("/api/newsroom/curation/scratchpad", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body: next }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      saved.current = next;
      setStatus("saved");
      setError(null);
    } catch {
      // Never a toast. A pad that interrupts with a dialog because a keystroke
      // did not reach the server is worse than one that says so quietly in its
      // own corner and keeps taking words.
      setStatus("failed");
    }
  }, []);

  /* Debounce, and flush whatever is outstanding on unmount — navigating away
     mid-sentence is the most likely way to lose a line, not a crash. */
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const change = (next: string) => {
    setText(next);
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next !== saved.current) void save(next);
    }, SAVE_AFTER_MS);
  };

  const written = text ? text.split("\n").filter((line) => line.trim().length > 0) : [];

  return (
    <section className="surface mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 p-5 text-left transition-colors duration-normal hover:bg-secondary/50"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-primary">
          <NotebookPen className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Scratchpad</span>
          <span className="block text-[12px] text-muted-foreground">
            {summary(open, text, written)}
          </span>
        </span>
        <span className="text-[12px] font-semibold text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-5">
          {text === null ? (
            <p className="text-sm text-muted-foreground">Opening the scratchpad.</p>
          ) : (
            <>
              <label className="sr-only" htmlFor="scratchpad">
                Scratchpad
              </label>
              <textarea
                id="scratchpad"
                value={text}
                onChange={(event) => change(event.target.value)}
                onBlur={() => {
                  // Leaving the field is a stronger signal than a pause, so it
                  // does not wait out the timer.
                  if (timer.current) clearTimeout(timer.current);
                  if (text !== saved.current) void save(text);
                }}
                rows={14}
                spellCheck
                placeholder="Anything. It is not filed, not attached to a piece, and nobody else reads it."
                /* Tinted rather than white, and set in the reading face at a
                   generous line height: this is somewhere to think, and a
                   white box with tight leading reads as a field on a form —
                   which is the one thing the pad is trying not to be. */
                className="focus-ring w-full resize-y rounded-lg border border-border bg-secondary/30 px-4 py-3.5 font-sans text-sm leading-7 outline-none transition-colors focus:border-accent focus:bg-background"
              />

              <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
                {error ?? state(status)}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The line under the heading.
 *
 * Before it has been opened there is no text to count, and it says so rather
 * than claiming "empty" — those are different, and only one of them is
 * something this component knows.
 */
function summary(open: boolean, text: string | null, written: string[]): string {
  if (open) return "Not filed, not attached to a piece. Saves as you type.";
  if (text === null) return "Loose thinking, kept between screens.";
  if (written.length === 0) return "Empty.";

  /*
   * The first line, not just a count.
   *
   * "4 lines" tells somebody there is something in the pad but not whether it
   * is the thing they are trying to remember — which means opening it to find
   * out, every time. The opening words usually answer that on their own, and
   * the count follows for the rest.
   */
  const first = written[0]!.trim();
  const head = first.length > 58 ? `${first.slice(0, 58).trimEnd()}…` : first;
  return written.length === 1 ? head : `${head} · ${written.length} lines`;
}

/** Said quietly, in the pad's own corner. */
function state(status: Status): string {
  if (status === "saving") return "Saving.";
  if (status === "saved") return "Saved.";
  if (status === "failed") {
    return "Not saved — the newsroom could not be reached. What you have typed is still here, and the next keystroke tries again.";
  }
  return "Saves on its own, a moment after you stop typing.";
}
