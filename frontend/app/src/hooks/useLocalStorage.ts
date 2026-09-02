"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Persisted state with a safe fallback, shared across every hook using the
 * same key.
 *
 * Storage can throw (private mode, disabled cookies, quota) — a reader must
 * never lose the page over a preference, so every access is guarded and the
 * hook degrades to plain in-memory state.
 *
 * ── Why the in-document channel ──────────────────────────────────────────
 * The `storage` event fires in *other* documents, never in the one that wrote
 * the value. So two components reading the same key in the same page would
 * never see each other's writes: the reading controls wrote a new text size
 * and the article, reading the same key from its own instance, kept rendering
 * the old one. Persisted, and completely inert.
 *
 * The registry below closes that: a write notifies every live subscriber for
 * that key in this document, and the `storage` listener continues to handle
 * other tabs. One key, one value, wherever it is read.
 */

type Listener = (value: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

function broadcast(key: string, value: unknown, self: Listener) {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) {
    // The writer already has this value in its own state; re-setting it would
    // just be an extra render.
    if (listener !== self) listener(value);
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  /**
   * Starts at the fallback, always — even though the value is sitting right
   * there in storage.
   *
   * ── Why the obvious version is wrong ─────────────────────────────────────
   * This used to read storage inside the `useState` initialiser, which runs
   * during the first client render. That render is the one React compares
   * against the server's HTML, and the server has no storage to read — so
   * every preference that differed from its default was a hydration mismatch:
   * "the server rendered HTML didn't match the client", the tree thrown away
   * and rebuilt. A collapsed admin sidebar produced exactly that, and so
   * would a remembered grid view, a chosen reading size or a saved playback
   * rate. Silent, because React recovers by re-rendering — and expensive,
   * because recovering means discarding the server's work on that whole tree.
   *
   * So the stored value arrives one paint later, in an effect. The visible
   * cost is that a remembered preference can flicker in on mount; the cost of
   * the other order is a hydration error on every screen that has one.
   */
  const [value, setValue] = useState<T>(initial);

  // Identity for this instance, so a broadcast can skip its own author.
  const self = useRef<Listener>(() => {});

  /**
   * True once storage has been read. The write effect below waits for it —
   * otherwise the first pass would write the *fallback* over the stored value
   * before anybody had a chance to read it, which turns "remember this" into
   * "forget this on every load".
   */
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    try {
      const raw = window.localStorage.getItem(key);
      // The extra render this causes is the entire point of the hook, and the
      // reason the rule is suppressed rather than the code changed: the value
      // cannot be read during render without contradicting the server's HTML,
      // so it is read after the first paint and applied here. See the note on
      // `useState(initial)` above for why that trade is the right way round.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Private mode, disabled storage, malformed JSON: keep the fallback.
    }
    loaded.current = true;
  }, [key]);

  useEffect(() => {
    const listener: Listener = (next) => setValue(next as T);
    self.current = listener;

    const set = listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(key, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) listeners.delete(key);
    };
  }, [key]);

  useEffect(() => {
    // See `loaded`: writing before the read would erase the preference.
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // A preference is not worth an error boundary.
    }
    broadcast(key, value, self.current);
  }, [key, value]);

  // Other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        /* ignore malformed writes */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset] as const;
}
