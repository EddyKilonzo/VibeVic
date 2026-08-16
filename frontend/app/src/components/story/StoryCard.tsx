"use client";

import Link from "next/link";
import { ArrowUpRight, Headphones } from "lucide-react";
import type { Story } from "@/data/types";
import { genreName } from "@/data/content";
import { coverFor } from "@/lib/cover";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageReveal, Reveal } from "@/components/motion";
import { BookmarkButton } from "./BookmarkButton";

export interface StoryCardProps {
  story: Story;
  /** `feature` is the lead slot; `compact` is a text-only list row. */
  variant?: "default" | "feature" | "compact";
  /** Extra delay (ms); normally supplied by <StaggerItem> instead. */
  delay?: number;
  className?: string;
}

/**
 * The story card.
 *
 * Its hover state is a set of small, simultaneous signals rather than one big
 * move: the image scales 3.5%, the headline shifts 3px, the rule darkens and
 * the arrow slides. Metadata deliberately stays put — if the date moves, the
 * card reads as unstable.
 *
 * All of that lives in CSS (`.media-zoom`, `.nudge-x`, group-hover), so hover
 * costs no JavaScript, and `@media (hover: hover)` keeps it off touch devices
 * where a press state is the honest affordance.
 */
export function StoryCard({ story, variant = "default", delay = 0, className }: StoryCardProps) {
  const isFeature = variant === "feature";
  const isCompact = variant === "compact";

  if (isCompact) {
    return (
      <Reveal variant="fade-up" delay={delay} distance="sm" as="li">
        <Link
          href={`/stories/${story.slug}`}
          className="group focus-ring press flex items-baseline gap-5 border-b border-border py-5 transition-colors duration-normal hover:border-primary"
        >
          <span className="rule-label w-24 shrink-0 tabular-nums">
            {formatShortDate(story.publishedAt)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-lg font-semibold leading-snug tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
              {story.title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {genreName(story.genre)} · {story.readingMinutes} min read
            </span>
          </span>
          <ArrowUpRight
            className="nudge-x mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden
          />
        </Link>
      </Reveal>
    );
  }

  return (
    <Reveal variant="fade-up" delay={delay} as="article" className={cn("group relative", className)}>
      <Link
        href={`/stories/${story.slug}`}
        className="focus-ring press block"
        aria-label={`Read ${story.title}`}
      >
        <ImageReveal
          src={coverFor(story.slug)}
          alt=""
          ratio={isFeature ? "16/9" : "16/10"}
          hoverZoom
          priority={isFeature}
          className="mb-5 rounded-lg shadow-card transition-shadow duration-normal group-hover:shadow-card-hover"
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="kicker">{genreName(story.genre)}</p>
          {/* Template pieces are labelled in the listing too, so a reader knows
              before they click rather than after. */}
          {story.placeholder && (
            <span className="rounded-full border border-dashed border-accent/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
              Template
            </span>
          )}
        </div>

        <h3
          className={cn(
            "font-display mt-2.5 font-semibold leading-[1.18] tracking-tight text-balance",
            "transition-transform duration-normal ease-entrance",
            "group-hover:translate-x-[3px] motion-reduce:transform-none",
            isFeature ? "text-3xl sm:text-[2.6rem]" : "text-xl sm:text-[1.4rem]",
          )}
        >
          {story.title}
        </h3>

        <p
          className={cn(
            "mt-3 leading-relaxed text-muted-foreground",
            isFeature ? "max-w-2xl text-base" : "text-[0.94rem]",
          )}
        >
          {story.dek}
        </p>

        {/* Metadata holds still on hover — only the arrow moves. */}
        <div className="mt-4 flex items-center gap-3 text-[13px] text-muted-foreground">
          <time dateTime={story.publishedAt}>{formatShortDate(story.publishedAt)}</time>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span>{story.readingMinutes} min read</span>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span className="inline-flex items-center gap-1.5">
            <Headphones className="h-3.5 w-3.5" aria-hidden />
            Listen
          </span>
          <ArrowUpRight
            className="nudge-x ml-auto h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden
          />
        </div>
      </Link>

      {/* Outside the <a> so saving never navigates. */}
      <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-normal focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        <BookmarkButton itemId={story.slug} title={story.title} variant="floating" />
      </div>
    </Reveal>
  );
}
