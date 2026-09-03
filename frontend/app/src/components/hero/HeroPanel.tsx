"use client";

/*
 * A client component only because of the body attribute it sets — see the
 * effect below. `children` is still whatever the caller passed, server
 * components included: they are rendered by the parent and arrive here as
 * elements, so nothing under a hero is dragged into the bundle by this.
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * The inset gradient slab every hero sits on.
 *
 * It is a server component with no JavaScript: the colour is a CSS mesh and
 * the texture is a mask, so the most visually loaded part of the page paints
 * on the first frame rather than waiting for hydration.
 *
 * The panel is inset from the window on all four sides. That inset is what
 * makes the floating masthead read as floating — a capsule over a full-bleed
 * background is just a bar, but a capsule over a card has somewhere to be.
 */
export function HeroPanel({
  children,
  className,
  /** Extra bottom padding for heroes whose content overhangs the edge. */
  bleed = false,
  /**
   * Hold the panel to one screen.
   *
   * `svh` rather than `vh`: on a phone `100vh` is measured against the
   * *largest* viewport, the one you only get after the browser's address bar
   * has retracted, so a `100vh` hero is taller than the screen for as long as
   * the bar is showing — which is the whole time, if the reader never
   * scrolls. `100svh` is the smallest viewport and is the only one that
   * actually fits on arrival.
   *
   * The content is centred rather than top-aligned, so a short viewport
   * squeezes the space around it instead of pushing the last row off the
   * bottom edge.
   */
  fitViewport = false,
  /**
   * A fraction of the screen for the panel to fill, e.g. `70` for 70svh.
   *
   * Inner pages want a hero with presence but not a whole screen — the reader
   * came for what is underneath it. Seventy per cent leaves the top of the
   * content visible at the fold, which is what tells them to keep going.
   */
  minViewport,
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
  fitViewport?: boolean;
  minViewport?: number;
}) {
  /*
   * Tell the page there is a dark slab at the top of it.
   *
   * The header is fixed and lives in the layout, so it is not a sibling of
   * this element in any way CSS can select across — and it needs to know,
   * because white nav text is right over this panel and invisible on the
   * three page types that have no hero at all (About, an article, a video).
   *
   * A body attribute rather than a prop or a context: the header does not
   * care *which* hero is present or anything about it, only whether the top
   * of the page is dark, and that is one bit. Cleared on unmount so a
   * client-side navigation to a page without a hero puts the dark text back.
   */
  useEffect(() => {
    document.body.dataset.hero = "dark";
    return () => {
      delete document.body.dataset.hero;
    };
  }, []);

  return (
    /*
     * Full bleed. The panel used to sit inset by 8-12px with a 28px radius, so
     * it read as a card laid on the page; edge to edge it reads as the top of
     * the page itself, which is what a hero is.
     */
    <div>
      <section
        className={cn(
          "hero-panel honeycomb honeycomb-strong",
          bleed ? "pb-0" : fitViewport ? "pb-10 sm:pb-12" : "pb-16 sm:pb-20",
          fitViewport
            ? "flex min-h-svh flex-col justify-center pt-24 sm:pt-28"
            : "pt-28 sm:pt-36",
          minViewport && !fitViewport && "flex flex-col justify-center",
          className,
        )}
        style={
          minViewport && !fitViewport
            ? // `svh` for the same reason as above: the small viewport is the
              // one that is actually on screen while the address bar is up.
              { minHeight: `${minViewport}svh` }
            : undefined
        }
      >
        {children}
      </section>
    </div>
  );
}

/**
 * The small pill above a headline.
 *
 * Reserved for a fact — a count, a source, a verified handle. It is the one
 * place in the hero where a claim can be made compactly, so it must never
 * carry marketing copy that the page cannot back up.
 */
export function HeroBadge({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="glass-chip frost inline-flex items-center gap-2 border-white/60 text-[11px] uppercase tracking-[0.16em] text-primary">
      {icon}
      {children}
    </span>
  );
}
