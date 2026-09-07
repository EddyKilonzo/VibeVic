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

  /** The pending debounce, so an explicit save can cancel it. */
  const timer = useRef<number | null>(null);
  /** Guards against a flush landing on top of a save already in flight. */
  const inFlight = useRef(false);

  /**
   * Save now, without waiting out the debounce.
   *
   * ── Why this exists when everything is saved anyway ──────────────────────
   * Because ⌘S is a reflex, and the editor's answer to it was the browser's
   * "save this page" dialog — which is both useless and slightly alarming, in
   * a tool where the thing you are trying to protect is a draft. Autosave is
   * the right design and the indicator does say where the words are, but a
   * writer who has just typed something they care about wants to *do*
   * something about it, and telling them the software has it under control is
   * not the same as letting them check.
   *
   * So the keystroke is honoured rather than swallowed: it cancels the pending
   * timer and saves immediately, which is what the writer asked for and is
   * also strictly cheaper than the debounce it replaced.
   */
  const saveNow = useCallback(async () => {
    if (inFlight.current) return;
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    inFlight.current = true;
    setStatus("saving");
    try {
      await save(latest.current);
      setStatus("saved");
      setSavedAt(new Date());
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
    // `save` is recreated per render at most call sites; it is read at call
    // time rather than captured, for the same reason the debounce does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Callers replace the whole object on every edit, so identity is the
    // signal. A deep comparison would cost a walk of the entire article body
    // on every keystroke to answer a question identity already answers.
    if (Object.is(loaded.current, value)) return;

    setStatus("unsaved");
    const id = window.setTimeout(async () => {
      timer.current = null;
      if (inFlight.current) return;
      inFlight.current = true;
      setStatus("saving");
      try {
        await save(latest.current);
        setStatus("saved");
        setSavedAt(new Date());
      } catch {
        setStatus("error");
      } finally {
        inFlight.current = false;
      }
    }, delayMs);
    timer.current = id;

    return () => {
      window.clearTimeout(id);
      if (timer.current === id) timer.current = null;
    };
    // `save` is recreated per render in most call sites; `value` is the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  return { status, savedAt, saveNow } as const;
}
