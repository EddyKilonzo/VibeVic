"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import { distance as distanceTokens, transitions, viewport } from "@/lib/motion";
import { useStaggerDelay } from "./Stagger";

export type RevealVariant =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "fade-scale"
  | "mask"
  | "mask-left";

/** Hidden states per variant. Transform + opacity + clip-path only. */
function hiddenState(variant: RevealVariant, d: number) {
  switch (variant) {
    case "fade":
      return { opacity: 0 };
    case "fade-up":
      return { opacity: 0, y: d };
    case "fade-down":
      return { opacity: 0, y: -d };
    case "fade-left":
      return { opacity: 0, x: d };
    case "fade-right":
      return { opacity: 0, x: -d };
    case "fade-scale":
      return { opacity: 0, scale: 0.97 };
    case "mask":
      return { opacity: 0, clipPath: "inset(0% 0% 100% 0%)", scale: 1.015 };
    case "mask-left":
      return { opacity: 0, clipPath: "inset(0% 100% 0% 0%)" };
  }
}

const VISIBLE = { opacity: 1, x: 0, y: 0, scale: 1, clipPath: "inset(0% 0% 0% 0%)" };

export interface RevealProps {
  children: ReactNode;
  /** Which entrance to use. */
  variant?: RevealVariant;
  /** Extra delay (ms) on top of any inherited <Stagger> delay. */
  delay?: number;
  distance?: keyof typeof distanceTokens | number;
  /** Animate on mount instead of on scroll — for page-load sequences. */
  immediate?: boolean;
  /** Re-run each time it re-enters the viewport. Off by default. */
  repeat?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "li" | "span" | "header" | "figure" | "aside";
}

/**
 * The single scroll-reveal primitive, built on Motion's `whileInView`.
 *
 * Everything that enters on scroll — a heading, a card, an image, a timeline
 * row — goes through this component, so one change to the curve changes the
 * whole site. Motion handles the observer, so there is no scroll listener
 * anywhere on the reveal path.
 *
 * Under reduced motion it renders a plain element: no variants, no observer,
 * content visible immediately.
 */
export function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  distance = "md",
  immediate = false,
  repeat = false,
  className,
  style,
  as = "div",
}: RevealProps) {
  const reduced = useReducedMotion();
  const inherited = useStaggerDelay();
  const px = typeof distance === "number" ? distance : distanceTokens[distance];

  const Tag = motion[as];

  if (reduced) {
    const Plain = as;
    return (
      <Plain className={className} style={style}>
        {children}
      </Plain>
    );
  }

  const variants: Variants = {
    hidden: hiddenState(variant, px),
    visible: {
      ...VISIBLE,
      transition: { ...transitions.editorial, delay: (inherited + delay) / 1000 },
    },
  };

  const trigger = immediate
    ? { animate: "visible" as const }
    : {
        whileInView: "visible" as const,
        viewport: { once: !repeat, margin: viewport.margin, amount: viewport.amount },
      };

  return (
    <Tag
      className={cn(className)}
      style={style}
      initial="hidden"
      variants={variants}
      {...trigger}
    >
      {children}
    </Tag>
  );
}

/* ── Named shorthands ─────────────────────────────────────────────
   Same primitive, read more clearly at the call site.              */

export const FadeIn = (p: Omit<RevealProps, "variant">) => <Reveal {...p} variant="fade" />;
export const FadeUp = (p: Omit<RevealProps, "variant">) => <Reveal {...p} variant="fade-up" />;
export const FadeInScale = (p: Omit<RevealProps, "variant">) => (
  <Reveal {...p} variant="fade-scale" />
);
