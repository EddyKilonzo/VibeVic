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
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <div className="px-2 pt-2 sm:px-3 sm:pt-3">
      <section
        className={cn(
          "hero-panel honeycomb honeycomb-strong",
          bleed ? "pb-0" : "pb-16 sm:pb-20",
          "pt-28 sm:pt-36",
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
    <span className="glass-chip inline-flex items-center gap-2 border-white/60 text-[11px] uppercase tracking-[0.16em] text-primary">
      {icon}
      {children}
    </span>
  );
}
