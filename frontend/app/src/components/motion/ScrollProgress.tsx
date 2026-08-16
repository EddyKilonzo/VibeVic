"use client";

import type { RefObject } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export interface ScrollProgressProps {
  /** Measure progress through this element instead of the whole document. */
  target?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * The article reading progress bar: 2px, brand accent, pinned under the header.
 *
 * `useScroll` drives a motion value straight into `scaleX` — no React render
 * per frame, no width writes, nothing off the compositor. The spring takes the
 * step out of trackpad scrolling without adding perceptible lag.
 */
export function ScrollProgress({ target, className }: ScrollProgressProps) {
  const { scrollYProgress } = useScroll(
    target ? { target: target as RefObject<HTMLElement>, offset: ["start start", "end end"] } : undefined,
  );

  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });
  // The bar stays out of the way until the reader has actually started.
  const opacity = useTransform(scrollYProgress, [0, 0.008], [0, 1]);

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]", className)}
    >
      <motion.div className="h-full origin-left bg-accent" style={{ scaleX, opacity }} />
    </div>
  );
}
