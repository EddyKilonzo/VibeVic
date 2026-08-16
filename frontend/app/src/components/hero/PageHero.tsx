"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { HeroBadge, HeroPanel } from "./HeroPanel";

export interface PageHeroProps {
  /** Small caps label above the title. */
  label: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Optional fact pill above the title — a count, a handle, a source. */
  badge?: ReactNode;
  badgeIcon?: ReactNode;
  /** Buttons, centred under the lead. */
  actions?: ReactNode;
  /** Filters or a chip rail, rendered on hairlines below the actions. */
  rail?: ReactNode;
  className?: string;
}

/**
 * The hero every inner page uses.
 *
 * Before this, nine pages each hand-rolled the same label-title-lead stack
 * with slightly different margins, which is how a site ends up feeling
 * assembled rather than designed. One component means the rhythm is identical
 * everywhere and a change to the hero is a change to the hero.
 *
 * Centred rather than left-aligned: on a panel this wide, a left-aligned
 * headline leaves a large empty right half that only reads as a mistake. The
 * body copy below stays left-aligned, because centred paragraphs are hard to
 * read past two lines.
 */
export function PageHero({
  label,
  title,
  lead,
  badge,
  badgeIcon,
  actions,
  rail,
  className,
}: PageHeroProps) {
  return (
    <HeroPanel className={className}>
      <div className="container-site flex flex-col items-center text-center">
        {badge && (
          <Reveal variant="fade-up" distance="sm">
            <HeroBadge icon={badgeIcon}>{badge}</HeroBadge>
          </Reveal>
        )}

        <Reveal variant="fade-up" delay={60} className={cn(badge && "mt-6")}>
          <p className="rule-label">{label}</p>
          <h1 className="font-display display-1 mt-3 font-semibold text-balance">
            {title}
          </h1>
        </Reveal>

        {lead && (
          <Reveal variant="fade-up" delay={120}>
            {/* Fraunces at reading size, matching the reference's serif
                subhead — it separates the promise from the headline without
                a second colour or weight. */}
            <p className="font-display lead-copy mx-auto mt-6 max-w-[46ch] text-muted-foreground">
              {lead}
            </p>
          </Reveal>
        )}

        {actions && (
          <Reveal variant="fade-up" delay={180} className="mt-9">
            <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>
          </Reveal>
        )}
      </div>

      {rail && (
        <Reveal variant="fade-up" delay={240} className="container-site mt-12">
          <div className="rail">{rail}</div>
        </Reveal>
      )}
    </HeroPanel>
  );
}

/**
 * Emphasises a phrase in a hero lead with the underline used throughout the
 * site, so a keyword in the subhead looks like the same language as a link
 * in the body rather than a new kind of highlight.
 */
export function LeadMark({ children }: { children: ReactNode }) {
  return (
    <span className="text-foreground underline decoration-accent/45 decoration-2 underline-offset-4">
      {children}
    </span>
  );
}
