"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a media query.
 *
 * `useSyncExternalStore` rather than state-plus-effect: matchMedia *is* an
 * external store, and reading it through the dedicated primitive means the
 * value is correct on the very first render instead of flipping one frame
 * after mount — which for layout-affecting queries is a visible reflow.
 *
 * The server snapshot is `false` by design. There is no viewport during
 * prerender, so any answer would be a guess; returning false means the markup
 * describes the mobile-first base case, which is the one that must be right.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True on coarse pointers — used to swap hover affordances for press states. */
export function useIsTouch(): boolean {
  return useMediaQuery("(hover: none)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
