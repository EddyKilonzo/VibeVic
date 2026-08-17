"use client";

import { useRef } from "react";

/** See the note in `Stagger` — `ElementType` is unusable once R3F is present. */
type HeadingTag = "h1" | "h2" | "h3" | "p" | "div";
import { cn } from "@/lib/utils";
import { gsap, useGSAP } from "@/lib/gsap";
import { gsapEase, seconds, viewport } from "@/lib/motion";
import { useStaggerDelay } from "./Stagger";

export interface TextRevealProps {
  /** Each string is one visual line, revealed in sequence. */
  lines: string[];
  /** Delay before the first line (ms). */
  delay?: number;
  /** Gap between lines (ms). */
  step?: number;
  /** Play on mount rather than on scroll. */
  immediate?: boolean;
  className?: string;
  lineClassName?: string;
  as?: HeadingTag;
}

/**
 * Headline reveal: each line rises out from behind its own mask.
 *
 * This is GSAP's job rather than Motion's — it is a *sequence*, and a timeline
 * expresses "these five lines, 90ms apart, with the eyebrow already gone" far
 * more directly than five components each holding their own delay.
 *
 * The full text is ordinary flowing markup inside an overflow-hidden wrapper,
 * so the reveal is invisible to screen readers, to text selection and to
 * search engines.
 */
export function TextReveal({
  lines,
  delay = 0,
  step = 90,
  immediate = false,
  className,
  lineClassName,
  as: Tag = "h1",
}: TextRevealProps) {
  // Typed as the widest tag `as` allows, so the ref is assignable whichever
  // heading level a call site picks. GSAP only ever reads it as a scope root.
  const scope = useRef<HTMLHeadingElement & HTMLParagraphElement & HTMLDivElement>(null);
  const inherited = useStaggerDelay();

  useGSAP(
    () => {
      // gsap.matchMedia: under `prefers-reduced-motion: reduce` this block never
      // runs, and the lines keep the visible styles set in markup.
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".tr-line", { yPercent: 100, opacity: 0 });

        gsap.to(".tr-line", {
          yPercent: 0,
          opacity: 1,
          duration: seconds.slow,
          ease: gsapEase.editorial,
          delay: (inherited + delay) / 1000,
          stagger: step / 1000,
          scrollTrigger: immediate
            ? undefined
            : {
                trigger: scope.current,
                start: viewport.scrollTriggerStart,
                // Replays on the way down and reverses on the way back up, to
                // match `Reveal`. `once: true` here would have left headings
                // as the one thing on the page that animated a single time.
                toggleActions: "play reverse play reverse",
              },
        });
      });

      return () => mm.revert();
    },
    { scope, dependencies: [lines.join("|"), immediate, delay, step, inherited] },
  );

  return (
    <Tag ref={scope} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <span className={cn("tr-line block", lineClassName)}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
