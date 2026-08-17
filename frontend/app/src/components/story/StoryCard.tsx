"use client";

import Link from "next/link";
import { ArrowUpRight, Headphones } from "lucide-react";
import type { Story } from "@/data/types";
import { genreName } from "@/data/content";
import { storyCover } from "@/lib/cover";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageReveal, Reveal } from "@/components/motion";
import { BookmarkButton } from "./BookmarkButton";
import { ReadProgress } from "./ReadProgress";

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
          {/* Wide enough for "Aug 1, 2026" at this tracking — at `w-24` the
              year wrapped onto its own line and the row lost its baseline. */}
          <span className="rule-label w-[7.5rem] shrink-0 whitespace-nowrap tabular-nums">
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
    <Reveal
      variant="fade-up"
      delay={delay}
      as="article"
      className={cn("group relative h-full", className)}
    >
      {/* The card is a real surface: the cover runs to the card's own edges
          and the text sits on a padded sheet.

          The lead runs *across* rather than down. Stacked, a full-width
          feature put a 16:9 cover at the container's whole width — most of a
          screen of decorative gradient before a single word of the piece.
          Side by side, the cover is a third of the width and the card's
          height is set by its text, which is the thing worth reading. Below
          `sm` it falls back to the stacked layout, where a column is the only
          honest arrangement anyway. */}
      <Link
        href={`/stories/${story.slug}`}
        className={cn(
          "surface surface-hover focus-ring press h-full overflow-hidden",
          isFeature ? "grid sm:grid-cols-[minmax(0,38%)_minmax(0,1fr)]" : "flex flex-col",
        )}
        aria-label={`Read ${story.title}`}
      >
        <ImageReveal
          src={storyCover(story)}
          alt=""
          ratio="16/10"
          hoverZoom
          priority={isFeature}
          // `w-full` is load-bearing, and its absence was the bug where the
          // cover covered the headline. `ImageReveal` sets `aspect-ratio`
          // inline; give an element a definite height and an aspect ratio and
          // the browser derives the *width* from them — 513px tall at 16:10
          // became 821px wide inside a 337px grid column, and a grid item's
          // `min-width: auto` let it overflow rather than shrink. With both
          // dimensions definite the ratio is ignored and the picture fills its
          // cell exactly. Below `sm` the layout is stacked and the ratio does
          // the work as intended.
          className={cn("shrink-0", isFeature && "sm:h-full sm:w-full")}
        />

        {/* On the feature the column centres its content instead of pushing
            the meta to the floor. The cover sets the row height, so pinning
            the meta down left a band of empty card between the standfirst and
            the date — a gap that reads as something failing to load rather
            than as space. On the stacked card the floor is right, because
            there the text sets the height and neighbouring cards need their
            meta on one line. */}
        <div
          className={cn(
            "flex flex-1 flex-col p-5",
            isFeature ? "justify-center sm:p-7 lg:px-9 lg:py-8" : "sm:p-6",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="kicker">{genreName(story.genre)}</p>
            {/* Template pieces are labelled in the listing too, so a reader
                knows before they click rather than after. */}
            {story.placeholder && (
              <span className="rounded-full border border-dashed border-accent/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                Template
              </span>
            )}
          </div>

          <h3
            className={cn(
              "font-display font-semibold tracking-tight text-balance",
              "transition-transform duration-normal ease-entrance",
              "group-hover:translate-x-[3px] motion-reduce:transform-none",
              isFeature
                ? "mt-3 text-[1.6rem] leading-[1.12] sm:text-[1.75rem] lg:text-[2.1rem]"
                : "mt-2.5 text-xl leading-[1.18]",
            )}
          >
            {story.title}
          </h3>

          <p
            className={cn(
              "text-pretty text-muted-foreground",
              isFeature
                ? "mt-4 max-w-[50ch] text-[1.02rem] leading-[1.65]"
                : "mt-3 flex-1 text-[0.94rem] leading-relaxed",
            )}
          >
            {story.dek}
          </p>

          {/* Metadata holds still on hover — only the arrow moves. It sits on
              a hairline so the card has a floor. */}
          <div
            className={cn(
              "flex items-center gap-3 border-t border-border text-[13px] text-muted-foreground",
              isFeature ? "mt-7 pt-4" : "mt-6 pt-4",
            )}
          >
            <time dateTime={story.publishedAt}>{formatShortDate(story.publishedAt)}</time>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>{story.readingMinutes} min read</span>
            <span
              aria-hidden
              className="hidden h-3 w-px bg-border min-[420px]:block"
            />
            <span className="hidden items-center gap-1.5 text-primary min-[420px]:inline-flex">
              <Headphones className="icon-rise h-3.5 w-3.5" aria-hidden />
              Listen
            </span>
            {/* Pushed to the right of the meta row, where it reads as a note
                about the reader rather than a fact about the piece. Renders
                nothing at all until this browser has a mark for it. */}
            <ReadProgress slug={story.slug} className="ml-auto" />

            <ArrowUpRight
              className="nudge-x h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
              aria-hidden
            />
          </div>
        </div>
      </Link>

      {/* Outside the <a> so saving never navigates. */}
      <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-normal focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        <BookmarkButton itemId={story.slug} title={story.title} variant="floating" />
      </div>
    </Reveal>
  );
}

