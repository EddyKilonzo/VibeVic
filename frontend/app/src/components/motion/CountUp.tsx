"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { LOCALE } from "@/lib/format";

export interface CountUpProps {
  value: number;
  /** Counting starts here, as a fraction of `value`, so it never reads as zero. */
  from?: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * A statistic that counts up once, when it first scrolls into view, then stays
 * put. Dashboard numbers must be readable at a glance, so nothing here loops
 * or re-runs on re-render.
 */
export function CountUp({
  value,
  from = 0.72,
  durationMs = 1100,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [display, setDisplay] = useState(() => value * from);
  /**
   * The value this has already counted to, not merely "whether it ran".
   *
   * ── The bug this shape fixes ─────────────────────────────────────────
   * A boolean here meant the count was strictly one-shot, and one-shot is
   * wrong for every figure on the dashboard: they arrive from a fetch, so the
   * first render has `value = 0`. If the card was already on screen when that
   * happened — which on the dashboard it always is, the cards being above the
   * fold — the effect fired immediately, animated 0 to 0, and set the flag.
   * The real figure landed a moment later, the effect re-ran because `value`
   * is a dependency, and the flag turned it straight back around. The card
   * then read 0 for the rest of the session while the screen-reader span
   * beside it announced the true number.
   *
   * That is not a cosmetic miss: "0 published" on the screen a writer opens
   * first is a false statement about their own work, and it is most false on
   * a slow connection, where the fetch is most likely to lose the race.
   *
   * Holding the last counted value instead makes the rule the honest one:
   * count when the number changes to something new, and stay put when it does
   * not. Re-renders with the same value still animate nothing, which is what
   * the boolean was there to protect.
   */
  const counted = useRef<number | null>(null);

  useEffect(() => {
    // Under reduced motion the number is derived below, never animated, so
    // there is nothing to start here.
    if (!inView || reduced || counted.current === value) return;

    /*
     * From wherever it currently is, not from `value * from`.
     *
     * On the first count those are the same thing. On a later one — a figure
     * that changed after it had already been shown — starting from the
     * fraction would make the number jump backwards before running forwards,
     * which reads as the figure having dropped.
     */
    const start = counted.current === null ? value * from : display;
    counted.current = value;

    const controls = animate(start, value, {
      duration: durationMs / 1000,
      // easeOutExpo: fast arrival, calm settle.
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });

    return () => controls.stop();
    // `display` is read to pick a starting point and must not re-trigger this;
    // the guard above is what decides whether a run happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, from, durationMs, reduced]);

  // Reduced motion goes straight to the final figure — the number is the
  // information, and the count is only ever the presentation of it.
  const shown = reduced ? value : display;

  const formatted = shown.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {/* The final value is announced once, rather than every frame. */}
      <span aria-hidden>
        {prefix}
        {formatted}
        {suffix}
      </span>
      {/*
        `select-none` alongside `sr-only`, and the pairing is the point.
        `sr-only` hides text visually but leaves it in the selection, so
        dragging across a dashboard figure and copying it yields the number
        twice — "661661" rather than "661". Screen readers do not consult
        `user-select`, so refusing the selection costs nothing this span was
        put here to provide.
      */}
      <span className="sr-only select-none">
        {prefix}
        {value.toLocaleString(LOCALE)}
        {suffix}
      </span>
    </span>
  );
}
