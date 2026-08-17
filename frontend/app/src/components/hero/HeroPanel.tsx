import type { ReactNode } from "react";
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
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
  fitViewport?: boolean;
}) {
  return (
    <div className="px-2 pt-2 sm:px-3 sm:pt-3">
      <section
        className={cn(
          "hero-panel honeycomb honeycomb-strong",
          bleed ? "pb-0" : fitViewport ? "pb-10 sm:pb-12" : "pb-16 sm:pb-20",
          fitViewport
            ? "flex min-h-[calc(100svh-0.5rem)] flex-col justify-center pt-20 sm:min-h-[calc(100svh-0.75rem)] sm:pt-24"
            : "pt-28 sm:pt-36",
          className,
        )}
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
