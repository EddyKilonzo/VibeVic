"use client";

import { useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { transitions, viewport } from "@/lib/motion";
import { useStaggerDelay } from "./Stagger";

export interface ImageRevealProps {
  src: string;
  alt: string;
  /** CSS aspect-ratio, e.g. "16/9" or "4/5". */
  ratio?: string;
  delay?: number;
  immediate?: boolean;
  /** Adds the card hover scale. Only set this inside a `group` element. */
  hoverZoom?: boolean;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Editorial image entrance: the frame wipes open from the bottom edge while
 * the image relaxes out of a barely-perceptible 1.02 scale.
 *
 * Two conditions must both hold before it plays — in view *and* decoded. A
 * half-painted image sliding into place reads as broken rather than premium,
 * which is why this doesn't simply fire on intersection.
 */
export function ImageReveal({
  src,
  alt,
  ratio = "16/10",
  delay = 0,
  immediate = false,
  hoverZoom = false,
  priority = false,
  className,
  imgClassName,
}: ImageRevealProps) {
  const reduced = useReducedMotion();
  const inherited = useStaggerDelay();
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once: true,
    margin: viewport.margin,
    amount: viewport.amount,
  });

  const revealed = reduced || (loaded && (inView || immediate));

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ aspectRatio: ratio }}
    >
      {/* Holds the frame and covers the gap before decode. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-muted to-secondary",
          "transition-opacity duration-normal",
          loaded && "opacity-0",
        )}
      />
      <motion.img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        // A broken image should still resolve its frame rather than hang hidden.
        onError={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          hoverZoom && "media-zoom",
          imgClassName,
        )}
        initial={reduced ? false : { clipPath: "inset(0% 0% 100% 0%)", scale: 1.02, opacity: 0 }}
        animate={
          revealed
            ? {
                clipPath: "inset(0% 0% 0% 0%)",
                scale: 1,
                opacity: 1,
                transition: { ...transitions.editorial, delay: inherited / 1000 + delay / 1000 },
              }
            : undefined
        }
      />
    </div>
  );
}
