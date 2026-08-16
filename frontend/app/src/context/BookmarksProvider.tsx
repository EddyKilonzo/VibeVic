"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { notify } from "@/lib/toast";

interface BookmarksValue {
  slugs: string[];
  has: (slug: string) => boolean;
  /** Returns the new state, so the caller can animate the right direction. */
  toggle: (slug: string, title?: string) => boolean;
  remove: (slug: string) => void;
  clear: () => void;
  count: number;
}

const BookmarksContext = createContext<BookmarksValue | null>(null);

export function useBookmarks(): BookmarksValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarks must be used inside <BookmarksProvider>");
  return ctx;
}

/**
 * Saved stories, kept on the device.
 *
 * No account required — the brief is explicit that basic reading and listening
 * must not be gated, and a saved-stories list is not worth a sign-up wall.
 * Moving this to a server later means replacing the storage call; the surface
 * stays the same.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useLocalStorage<string[]>("vv:bookmarks", []);

  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const toggle = useCallback(
    (slug: string, title?: string) => {
      const saved = slugs.includes(slug);
      setSlugs((prev) => (saved ? prev.filter((s) => s !== slug) : [...prev, slug]));

      if (saved) {
        notify.undo("Removed from saved", () => setSlugs((prev) => [...prev, slug]));
      } else {
        notify.success("Story saved", title);
      }
      return !saved;
    },
    [slugs, setSlugs],
  );

  const remove = useCallback(
    (slug: string) => setSlugs((prev) => prev.filter((s) => s !== slug)),
    [setSlugs],
  );

  const clear = useCallback(() => setSlugs([]), [setSlugs]);

  const value = useMemo(
    () => ({ slugs, has, toggle, remove, clear, count: slugs.length }),
    [slugs, has, toggle, remove, clear],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}
