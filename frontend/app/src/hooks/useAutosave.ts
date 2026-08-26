"use client";

import { useEffect, useRef, useState } from "react";

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
  latest.current = value;

  useEffect(() => {
    // Callers replace the whole object on every edit, so identity is the
    // signal. A deep comparison would cost a walk of the entire article body
    // on every keystroke to answer a question identity already answers.
    if (Object.is(loaded.current, value)) return;

    setStatus("unsaved");
    const timer = window.setTimeout(async () => {
      setStatus("saving");
      try {
        await save(latest.current);
        setStatus("saved");
        setSavedAt(new Date());
      } catch {
        setStatus("error");
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
    // `save` is recreated per render in most call sites; `value` is the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  return { status, savedAt } as const;
}
