"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Keeps the paragraph being spoken visible — without stealing the page.
 *
 * Three rules make this tolerable rather than intrusive:
 *
 *  1. It only scrolls when the spoken paragraph has actually left a comfortable
 *     reading band. If the reader is already looking at it, nothing moves.
 *  2. Any manual scroll suspends it for a few seconds. A reader glancing back
 *     at an earlier paragraph must not be yanked forward mid-sentence.
 *  3. Under reduced motion the scroll is instant rather than smooth — the
 *     content still follows, the animation does not.
 */
export function useFollowAlong(activeBlockId: string | null, enabled: boolean) {
  const reduced = useReducedMotion();
  const suspendedUntil = useRef(0);
  const selfScrolling = useRef(false);

  // Distinguish the reader's scrolling from our own.
  useEffect(() => {
    if (!enabled) return;

    const onScroll = () => {
      if (selfScrolling.current) return;
      suspendedUntil.current = Date.now() + 4000;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onScroll);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !activeBlockId) return;
    if (Date.now() < suspendedUntil.current) return;

    const el = document.querySelector<HTMLElement>(`[data-block-id="${activeBlockId}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // Comfortable band: below the header, above the mobile mini-player.
    const top = 140;
    const bottom = window.innerHeight - 180;
    if (rect.top >= top && rect.bottom <= bottom) return;

    selfScrolling.current = true;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });

    // Release the flag once our own smooth scroll has settled.
    const t = window.setTimeout(() => {
      selfScrolling.current = false;
    }, reduced ? 60 : 700);
    return () => window.clearTimeout(t);
  }, [activeBlockId, enabled, reduced]);
}
