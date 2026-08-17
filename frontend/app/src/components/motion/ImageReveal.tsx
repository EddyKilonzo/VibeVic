"use client";

import { useCallback, useState } from "react";
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
  /**
   * Tried once if `src` fails to load.
   *
   * Exists for YouTube poster frames: `maxresdefault` is the sharp one but
   * does not exist for every upload, and asking for a missing frame returns a
   * grey placeholder rather than an error. Stepping down keeps the crisp frame
   * wherever it is available without risking a blank card where it is not.
   */
  fallbackSrc?: string;
}

/** How far outside the viewport a frame starts fetching. */
const LOAD_MARGIN = "500px";

/**
 * A real poster is at least this wide. YouTube answers a request for a frame
 * it does not have with a 120×90 grey placeholder and a 200, so width is the
 * only signal that the image which arrived is not the image asked for.
 */
const PLACEHOLDER_WIDTH = 200;

/**
 * Editorial image entrance: the frame wipes open from the bottom edge while
 * the image relaxes out of a barely-perceptible 1.02 scale.
 *
 * Two conditions must both hold before it plays — in view *and* decoded. A
 * half-painted image sliding into place reads as broken rather than premium,
 * which is why this doesn't simply fire on intersection.
 *
 * ── Why the wipe is on a wrapper and not on the <img> ────────────────────
 * It used to be on the image, and that was a deadlock rather than a style
 * choice. `clip-path: inset(0 0 100% 0)` collapses an element's visible area
 * to nothing, and Chrome's native lazy-loading will not fetch an image with no
 * visible area. So the image waited for the reveal, the reveal waited for
 * `onLoad`, and neither happened: below the fold, cards stayed as empty
 * placeholder blocks until a reload put them above it. Clipping a wrapper
 * instead leaves the image's own box untouched, so it loads exactly when the
 * browser would otherwise load it.
 */
export function ImageReveal({
  src,
  alt,
  ratio = "16/10",
  delay = 0,
  immediate = false,
  hoverZoom = false,
  priority = false,
  fallbackSrc,
  className,
  imgClassName,
}: ImageRevealProps) {
  const reduced = useReducedMotion();
  const inherited = useStaggerDelay();
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState(src);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once: true,
    margin: viewport.margin,
    amount: viewport.amount,
  });

  // A second, much earlier observer, and the whole reason this component owns
  // its loading rather than leaving it to `loading="lazy"`: the wipe below is
  // a clip-path, and a clipped element has no visible area, which is precisely
  // the condition under which Chrome refuses to fetch a lazy image. Deciding
  // here — 500px out, well before the frame is on screen — means the bytes are
  // already in flight when the reveal plays, and nothing about the animation
  // can starve the image that it is animating.
  const near = useInView(ref, { once: true, margin: LOAD_MARGIN });
  const shouldLoad = priority || immediate || near;

  const revealed = reduced || (loaded && (inView || immediate));

  /**
   * The other half of "has it arrived", and the reason cached images used to
   * paint as empty plates.
   *
   * `onLoad` only fires for a decode that happens *after* React has attached
   * the handler. An image already in the browser cache — a second visit, a
   * client-side navigation back to a page, a hero the router prefetched — is
   * frequently `complete` before that, so the event never comes, `loaded`
   * stays false, and the wipe below never lifts its clip. The frame then sits
   * there as a placeholder gradient forever, which is precisely what it looked
   * like on the About hero.
   *
   * A ref callback runs at commit, when the element exists and its `complete`
   * flag can simply be read. Setting state from one is a commit-phase update,
   * not the cascading-render effect pattern.
   */
  const settle = useCallback(
    (element: HTMLImageElement | null) => {
      if (!element || !element.complete || element.naturalWidth === 0) return;
      if (fallbackSrc && source !== fallbackSrc && element.naturalWidth < PLACEHOLDER_WIDTH) {
        setSource(fallbackSrc);
        return;
      }
      setLoaded(true);
    },
    [fallbackSrc, source],
  );

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
      <motion.div
        className="absolute inset-0"
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
      >
        <img
          // Remounted when the source changes, so the ref callback below runs
          // again for the fallback rather than only for the first attempt.
          key={source}
          ref={settle}
          // Undefined until the frame is near, so nothing is requested for a
          // card the reader may never scroll to. `eager` is correct once it is
          // set: the decision has already been made here.
          src={shouldLoad ? source : undefined}
          alt={alt}
          loading="eager"
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={(event) => {
            // A YouTube poster that does not exist is not an error — the CDN
            // answers 200 with a 120×90 grey placeholder. So when a fallback
            // was supplied, a suspiciously small image counts as a miss and
            // steps down the same way a real failure would.
            const width = event.currentTarget.naturalWidth;
            if (fallbackSrc && source !== fallbackSrc && width > 0 && width < 200) {
              setSource(fallbackSrc);
              return;
            }
            setLoaded(true);
          }}
          onError={() => {
            // Step down once, then give up — a broken image should still
            // resolve its frame rather than hang hidden behind the placeholder.
            if (fallbackSrc && source !== fallbackSrc) setSource(fallbackSrc);
            else setLoaded(true);
          }}
          className={cn("h-full w-full object-cover", hoverZoom && "media-zoom", imgClassName)}
        />
      </motion.div>
    </div>
  );
}
