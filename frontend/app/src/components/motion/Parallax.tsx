"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gsap, useGSAP } from "@/lib/gsap";

export interface ParallaxProps {
  children: ReactNode;
  /** Total travel in px across a full pass through the viewport. Keep it small. */
  amount?: number;
  className?: string;
}

/**
 * A very small amount of depth — around 20px, never a scrolling backdrop.
 *
 * ScrollTrigger's `scrub` drives this from the scroll position directly, so
 * there is no scroll listener, no rAF loop of ours, and the transform is
 * recalculated only while the element is actually on screen.
 */
export function Parallax({ children, amount = 20, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { y: amount / 2 },
          {
            y: -amount / 2,
            ease: "none",
            scrollTrigger: {
              trigger: ref.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.4,
            },
          },
        );
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [amount] },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
