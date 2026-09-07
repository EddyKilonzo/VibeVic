"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

/**
 * Debounced autosave.
 *
 * The status is what the editor actually shows, so it is modelled explicitly
 * rather than inferred: a writer needs to know the difference between "not
 * saved yet", "saving now" and "saved", and needs to see the transition
 * happen. Loading a story is not an edit, and never triggers a save.
 *
 * ── Why that is a comparison and not a "first render" flag ───────────────
 * It used to be `const first = useRef(true)`, flipped to false on the first
 * effect run. Under StrictMode — which this app turns on — React mounts, runs
 * the effect, cleans up, and runs it again. The second run found the flag
 * already false and scheduled a save of a story nobody had touched.
 *
 * That was invisible while saving meant a `localStorage` write. It stopped
 * being invisible when it meant a PATCH: every time a journalist so much as
 * opened a draft, the editor sent it back to the API, and the indicator
 * announced a save for an edit that had not happened.
 *
 * Comparing against the value the hook mounted with is immune to the repeat,
 * because the repeat carries the same value. It also happens to be the more
 * honest statement of the rule: what must not be saved is the story as loaded,
 * not "whatever arrives on some particular render".
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 1200) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Captured once, never reassigned: this is the story as it was handed over.
  const loaded = useRef(value);
  const latest = useRef(value);

  /*
   * Synced after the commit rather than during render.
   *
   * This was `latest.current = value` in the render body. A render React
   * discards still leaves that write behind, so the value a save reads could
   * come from a pass that never reached the screen. The debounce below fires
   * from a timer at least `delayMs` later, and `saveNow` from a keystroke, so
   * in both cases the effect has long since flushed.
   */
  useEffect(() => {
    latest.current = value;
  }, [value]);

  /*
   * The save function, read at the moment it is called rather than captured.
   *
   * Call sites rebuild it on every render, and `flush` below is deliberately
   * built once so that neither the debounce nor the ⌘S binding is torn down
   * and rebuilt while somebody is typing. Holding it in a ref is what lets
   * both of those be stable without any of them going stale — and it is the
   * honest version of the `exhaustive-deps` suppressions that used to stand
   * here saying the same thing in a comment.
   */
  const saver = useRef(save);
  useEffect(() => {
    saver.current = save;
  }, [save]);

  /** The pending debounce, so an explicit save can cancel it. */
  const timer = useRef<number | null>(null);
  /**
   * The run that is talking to the server right now, if there is one.
   *
   * A promise rather than a boolean because callers wait on it: the publish
   * control awaits `saveNow` before it asks the server to put the piece in
   * front of readers, and "a save is happening" is not an answer it can use.
   * Held until the run has nothing left queued, so what it resolves to is
   * "everything typed up to now has been sent", which is the thing worth
   * waiting for.
   */
  const running = useRef<Promise<void> | null>(null);
  /** The value moved on while that run was in flight, and still needs sending. */
  const queued = useRef(false);

  /**
   * Save what is on screen now, without waiting out the debounce.
   *
   * ── Why an edit made during a save must not be dropped ───────────────────
   * This guard used to be `if (inFlight.current) return`, in both the debounce
   * and the explicit save, and it lost work. A save to Neon can take longer
   * than the 1200ms debounce — a cold connection routinely does — and a writer
   * who keeps typing through one produces exactly the sequence it mishandled:
   * a save goes out, more words are typed, the next debounce expires while the
   * first request is still open, and the guard returned. Nothing rescheduled
   * it. The first save then resolved, and the indicator said "Saved".
   *
   * So the words were on neither the server nor the device — `writeDraft` runs
   * inside the save that never ran — while the screen reported them safe,
   * which is the one failure this indicator exists to make impossible.
   *
   * Coalescing rather than dropping: a save that arrives during another one
   * sets a flag, and the loop below re-reads `latest` and goes again when the
   * request in flight settles. Only one request is ever open, the last one
   * always carries the newest text, and "Saved" is only said when nothing is
   * still waiting to go.
   *
   * ── Why the retry also happens after a failure ───────────────────────────
   * Because the queued value is newer than the one that just failed, and the
   * call site writes to the device before it touches the network — so the
   * extra pass is what puts the newest words somewhere at all. It cannot spin:
   * the flag is only ever set by a debounce expiring or a ⌘S, so each of those
   * buys exactly one more attempt.
   */
  const flush = useCallback((): Promise<void> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    // Already saving: add this to what that run still has to do, and hand back
    // the run itself so a caller that awaits gets the newest text, not the
    // request that happened to be open when it asked.
    if (running.current) {
      queued.current = true;
      return running.current;
    }

    const run = (async () => {
      try {
        do {
          // Cleared before the request, so anything arriving while it is open
          // is seen as new work rather than as the work being done right now.
          queued.current = false;
          setStatus("saving");
          try {
            await saver.current(latest.current);
            // Only the pass that leaves nothing behind gets to say "Saved".
            if (!queued.current) {
              setStatus("saved");
              setSavedAt(new Date());
            }
          } catch {
            if (!queued.current) setStatus("error");
          }
        } while (queued.current);
      } finally {
        running.current = null;
      }
    })();

    running.current = run;
    return run;
  }, []);

  useEffect(() => {
    // Callers replace the whole object on every edit, so identity is the
    // signal. A deep comparison would cost a walk of the entire article body
    // on every keystroke to answer a question identity already answers.
    if (Object.is(loaded.current, value)) return;

    setStatus("unsaved");
    const id = window.setTimeout(() => {
      timer.current = null;
      void flush();
    }, delayMs);
    timer.current = id;

    return () => {
      window.clearTimeout(id);
      if (timer.current === id) timer.current = null;
    };
  }, [value, delayMs, flush]);

  return { status, savedAt, saveNow: flush } as const;
}
