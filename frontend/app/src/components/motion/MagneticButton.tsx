"use client";

import type { ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/useMediaQuery";

export interface MagneticProps {
  children: ReactNode;
  /** Maximum pull in px. Deliberately tiny — this should be felt, not seen. */
  strength?: number;
  className?: string;
}

/**
 * A gentle pointer attraction for a single hero CTA.
 *
 * Motion values drive this, so the pull never triggers a React render — the
 * spring writes straight to the transform. Used sparingly: one per page at
 * most, and disabled entirely on touch (where there is no pointer to attract)
 * and under reduced motion.
 */
export function Magnetic({ children, strength = 5, className }: MagneticProps) {
  const reduced = useReducedMotion();
  const touch = useIsTouch();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 22, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 260, damping: 22, mass: 0.6 });

  if (reduced || touch) {
    return <span className={className}>{children}</span>;
  }

  const onMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    x.set(dx * strength);
    y.set(dy * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.span>
  );
}
