"use client";

import { useEffect, useRef, useState } from "react";

export interface HeaderState {
  /** Past the hero threshold — the header earns a background. */
  scrolled: boolean;
  /** Hidden while scrolling down deep in the page; returns on any upward scroll. */
  hidden: boolean;
}

const REVEAL_THRESHOLD = 12; // ignore trackpad jitter
const SOLID_AT = 24;
const HIDE_AFTER = 320; // never hide near the top

/**
 * Smart header behaviour. One passive listener, rAF-coalesced, and it only
 * ever flips two booleans — the visual change itself is a CSS transition.
 */
export function useHeaderState(): HeaderState {
  const [state, setState] = useState<HeaderState>({ scrolled: false, hidden: false });
  const lastY = useRef(0);

  useEffect(() => {
    let frame = 0;
    lastY.current = window.scrollY;

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (Math.abs(delta) < REVEAL_THRESHOLD) {
        setState((s) => (s.scrolled === y > SOLID_AT ? s : { ...s, scrolled: y > SOLID_AT }));
        return;
      }

      const hidden = delta > 0 && y > HIDE_AFTER;
      lastY.current = y;
      setState((s) =>
        s.scrolled === y > SOLID_AT && s.hidden === hidden
          ? s
          : { scrolled: y > SOLID_AT, hidden },
      );
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return state;
}
