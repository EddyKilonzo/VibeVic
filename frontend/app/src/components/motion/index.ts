"use client";

/**
 * The motion system's public surface.
 *
 * Pages import from here and never from `gsap` or `motion/react` directly, so
 * the engine behind any given primitive can change without touching a page.
 */
export { Reveal, FadeIn, FadeUp, FadeInScale, type RevealVariant } from "./Reveal";
export { Stagger, StaggerItem, useStaggerDelay } from "./Stagger";
export { TextReveal } from "./TextReveal";
export { Typewriter } from "./Typewriter";
export { ImageReveal } from "./ImageReveal";
export { Parallax } from "./Parallax";
export { Magnetic } from "./MagneticButton";
export { PageTransition } from "./PageTransition";
export { ScrollProgress } from "./ScrollProgress";
export { CountUp } from "./CountUp";
export { HeroSequence } from "./HeroSequence";
export { SmoothScroll } from "./SmoothScroll";
