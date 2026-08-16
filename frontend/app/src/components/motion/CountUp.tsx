"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

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
  const [display, setDisplay] = useState(() => (reduced ? value : value * from));
  const played = useRef(false);

  useEffect(() => {
    if (!inView || played.current) return;
    played.current = true;

    if (reduced) {
      setDisplay(value);
      return;
    }

    const controls = animate(value * from, value, {
      duration: durationMs / 1000,
      // easeOutExpo: fast arrival, calm settle.
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });

    return () => controls.stop();
  }, [inView, value, from, durationMs, reduced]);

  const formatted = display.toLocaleString(undefined, {
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
      <span className="sr-only">
        {prefix}
        {value.toLocaleString()}
        {suffix}
      </span>
    </span>
  );
}
