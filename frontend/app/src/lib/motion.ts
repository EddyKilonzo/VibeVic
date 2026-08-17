import type { Transition, Variants } from "motion/react";

/**
 * Central motion system.
 *
 * Three engines, one language. Which one runs a given animation is decided by
 * what the animation *is*, never by preference:
 *
 *   CSS    — hover, press, focus, skeleton shimmer, reading highlight.
 *            Stateless, compositor-only, zero JS on the interaction path.
 *   Motion — component state: mount/unmount, layout shifts, gestures, route
 *            transitions. Anything React already re-renders for.
 *   GSAP   — choreography and scroll-linked motion: the hero load timeline,
 *            ScrollTrigger scrubs, parallax. Anything that is a *sequence*.
 *
 * All three read their timing from the tokens below, and the identical values
 * exist as CSS custom properties in index.css.
 */

/** Durations in milliseconds (CSS) and seconds (Motion/GSAP). */
export const duration = {
  fast: 180,
  normal: 320,
  slow: 620,
} as const;

export const seconds = {
  fast: duration.fast / 1000,
  normal: duration.normal / 1000,
  slow: duration.slow / 1000,
} as const;

export type DurationToken = keyof typeof duration;

/** Easing as cubic-bezier control points — the canonical form. */
export const bezier = {
  ease: [0.4, 0, 0.2, 1],
  easeOut: [0.16, 1, 0.3, 1],
  /** The house curve: a long, calm tail. Every editorial reveal uses it. */
  editorial: [0.22, 0.61, 0.36, 1],
} as const;

/** The same curves as CSS/GSAP strings. */
export const easing = {
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  editorial: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  spring: "cubic-bezier(0.34, 1.28, 0.64, 1)",
} as const;

/** GSAP ease names, registered in lib/gsap.ts as custom eases. */
export const gsapEase = {
  ease: "vv.ease",
  easeOut: "vv.out",
  editorial: "vv.editorial",
} as const;

export type EasingToken = keyof typeof bezier;

/** Stagger steps in seconds. Tight by design — a grid must finish, not perform. */
export const stagger = {
  tight: 0.045,
  normal: 0.07,
  loose: 0.11,
} as const;

/** Travel distances (px) for directional reveals. */
export const distance = {
  sm: 8,
  md: 18,
  lg: 28,
} as const;

/**
 * When a scroll-triggered element counts as "in view".
 *
 * `amount` was 0.15 — fifteen per cent of the *element* had to be inside the
 * viewport. That is fine for a card and quietly broken for anything tall: an
 * element longer than about six screens can never show fifteen per cent of
 * itself at once, so its reveal simply never fired and the content sat at
 * opacity zero until something forced a re-render. A section that appears only
 * after a refresh is that bug, and it gets worse the longer the page gets.
 *
 * `"some"` is Motion's zero threshold: the moment any part of the element
 * enters the detection area it counts. The negative bottom margin still holds
 * the trigger a little inside the fold, so nothing fires while it is under the
 * edge of the screen — that is the part doing the editorial work, and it does
 * not depend on the element's own height.
 */
export const viewport = {
  /** Motion's `viewport.margin` / GSAP's ScrollTrigger start. */
  margin: "0px 0px -12% 0px",
  amount: "some",
  scrollTriggerStart: "top 88%",
} as const;

/**
 * The page-load sequence, in seconds from first paint.
 *
 * The header (a Motion component) and the hero (a GSAP timeline) both read
 * these, which is what keeps two engines reading as one entrance. Nothing here
 * gates interaction — the whole sequence is decoration over an already-usable
 * page, and it is over in well under a second.
 */
export const sequence = {
  texture: 0,
  nav: 0.06,
  eyebrow: 0.16,
  headline: 0.24,
  headlineStep: 0.08,
  support: 0.46,
  cta: 0.56,
  image: 0.34,
  decor: 0.68,
} as const;

/* ── Motion transitions ────────────────────────────────────────── */

export const transitions = {
  fast: { duration: seconds.fast, ease: bezier.ease },
  normal: { duration: seconds.normal, ease: bezier.easeOut },
  editorial: { duration: seconds.slow, ease: bezier.editorial },
  /** Restrained overshoot. Sheets and drawers only — never text. */
  sheet: { type: "spring", stiffness: 420, damping: 38, mass: 0.9 },
  /** For layout animations during filtering. */
  layout: { duration: seconds.normal, ease: bezier.easeOut },
} satisfies Record<string, Transition>;

/* ── Shared variant sets ───────────────────────────────────────── */

/**
 * Reveal variants, keyed the same way as the CSS `data-variant` values so the
 * two systems stay legible side by side.
 */
export function revealVariants(dist = distance.md): Variants {
  return {
    hidden: { opacity: 0, y: dist },
    visible: { opacity: 1, y: 0, transition: transitions.editorial },
  };
}

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.editorial },
};

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transitions.editorial },
};

/** Parent variant that sequences its children. */
export function staggerVariants(step: number = stagger.normal, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: step, delayChildren } },
  };
}

/** Reads the user's reduced-motion setting outside of React. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Build a CSS transition string from tokens (for the few inline cases). */
export function transition(
  properties: string[],
  d: DurationToken = "normal",
  e: keyof typeof easing = "editorial",
  delayMs = 0,
): string {
  return properties
    .map((p) => `${p} ${duration[d]}ms ${easing[e]}${delayMs ? ` ${delayMs}ms` : ""}`)
    .join(", ");
}
