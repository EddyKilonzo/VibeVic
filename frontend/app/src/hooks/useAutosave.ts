"use client";

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

/**
 * Debounced autosave.
 *
 * The status is what the editor actually shows, so it is modelled explicitly
 * rather than inferred: a writer needs to know the difference between "not
 * saved yet", "saving now" and "saved", and needs to see the transition
 * happen. The first render never triggers a save — loading a story is not an
 * edit.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 1200) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const first = useRef(true);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

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
