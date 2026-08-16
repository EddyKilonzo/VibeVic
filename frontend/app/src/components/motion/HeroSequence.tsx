"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { gsapEase, seconds, sequence } from "@/lib/motion";

/**
 * The page-load entrance, as a single GSAP timeline.
 *
 * Children opt in by tagging themselves:
 *
 *   data-seq="texture" | "eyebrow" | "headline" | "support" | "cta"
 *            | "image" | "decor"
 *
 * Choreography is exactly what timelines are for. Expressed as seven
 * independent components each holding a hand-tuned delay, the sequence would
 * drift the moment one duration changed; here the order is the code.
 *
 * The page is interactive throughout — nothing is covered, disabled or
 * pointer-blocked while this plays, and it is finished in about 900ms.
 */
export function HeroSequence({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Under reduced motion this block never runs and every element keeps its
      // natural, fully-visible layout.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: gsapEase.editorial } });

        tl.from(
          "[data-seq='texture']",
          { opacity: 0, duration: seconds.slow },
          sequence.texture,
        )
          .from(
            "[data-seq='eyebrow']",
            { opacity: 0, y: 10, duration: seconds.normal },
            sequence.eyebrow,
          )
          .from(
            "[data-seq='headline']",
            {
              yPercent: 100,
              opacity: 0,
              duration: seconds.slow,
              stagger: sequence.headlineStep,
            },
            sequence.headline,
          )
          .from(
            "[data-seq='image']",
            {
              clipPath: "inset(0% 0% 100% 0%)",
              scale: 1.03,
              duration: 0.9,
            },
            sequence.image,
          )
          .from(
            "[data-seq='support']",
            { opacity: 0, y: 12, duration: seconds.normal },
            sequence.support,
          )
          .from(
            "[data-seq='cta']",
            { opacity: 0, y: 12, duration: seconds.normal, stagger: 0.06 },
            sequence.cta,
          )
          .from(
            "[data-seq='decor']",
            { opacity: 0, duration: seconds.slow, stagger: 0.08 },
            sequence.decor,
          );

        /*
         * Content must never depend on an animation having run.
         *
         * A background tab suspends `requestAnimationFrame`, so the timeline
         * would never advance and every element would sit in its `from` state
         * — which for the hero means invisible — until the reader focused the
         * tab. Opening a link in a new tab is an ordinary thing to do, so the
         * entrance is skipped outright when the page starts hidden and the
         * hero is simply there when the reader arrives.
         */
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          tl.progress(1);
        }

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
