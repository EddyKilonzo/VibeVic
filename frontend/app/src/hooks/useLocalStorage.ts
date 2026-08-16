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
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  // Identity for this instance, so a broadcast can skip its own author.
  const self = useRef<Listener>(() => {});

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
