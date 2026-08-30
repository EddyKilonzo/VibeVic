"use client";

import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { topicName, type Video } from "@/data/videos";
import { VideoPoster } from "./VideoPoster";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { BookmarkButton } from "@/components/story/BookmarkButton";
import { ShareButton } from "@/components/story/ShareButton";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function publishedLabel(published: string): string {
  const [year, month] = published.split("-");
  return `${MONTHS[Number(month) - 1] ?? ""} ${year}`.trim();
}

/**
 * A report, as a card.
 *
 * Same restraint as the story card — the poster scales 3.5%, the title shifts
 * 3px, the arrow slides — so video and written work read as one body of work
 * rather than two sections built by different people.
 */
export function VideoCard({
  video,
  variant = "default",
  className,
}: {
  video: Video;
  variant?: "default" | "feature";
  className?: string;
}) {
  const isFeature = variant === "feature";

  return (
    <Reveal variant="fade-up" as="article" className={cn("group relative h-full", className)}>
      {/* The same shape as the story card, deliberately: one surface, the
          media running to its own edges, the words on a padded sheet with a
          hairline floor. Video and writing are one body of work and should
          not look like two sections built by different people.

          The feature runs across rather than down. A full-width 16:9 poster
          is most of a screen of thumbnail before the title, which is a lot of
          room to spend on a frame the reader is about to replace with the
          video anyway. */}
      <Link
        href={`/videos/${video.id}`}
        className={cn(
          "surface surface-hover focus-ring press h-full overflow-hidden",
          isFeature ? "grid sm:grid-cols-[minmax(0,46%)_minmax(0,1fr)]" : "flex flex-col",
        )}
        aria-label={`Watch ${video.title}`}
      >
        {/* One plate shape for every report, Shorts included.
            Shorts used to get a 9:16 box, which produced a 700px-tall tile
            beside 230px ones and broke the grid — and it did not even show
            the vertical frame, because YouTube's poster for a Short is a
            landscape image, so a 9:16 box just cropped its sides away. The
            badge is what says "Short"; the plate does not need to.
            The height cap stops a card that lands wide in the bento from
            becoming 400px of thumbnail before its title. */}
        <div
          className={cn(
            "relative aspect-video max-h-[300px] overflow-hidden bg-brand-ink-deep",
            isFeature && "sm:aspect-auto sm:h-full sm:max-h-none",
          )}
        >
          <VideoPoster
            id={video.id}
            className="media-zoom absolute inset-0"
            priority={variant === "feature"}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-brand-ink-deep/55 via-transparent to-transparent opacity-0 transition-opacity duration-normal group-hover:opacity-100"
          />
          <span
            aria-hidden
            className="glass absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-primary opacity-0 transition-opacity duration-normal group-hover:opacity-100"
          >
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          </span>
          <span className="absolute bottom-2.5 right-2.5 rounded bg-brand-ink-deep/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {video.duration}
          </span>
          {video.format === "short" && (
            <span className="absolute left-2.5 top-2.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
              Short
            </span>
          )}
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col p-5",
            isFeature ? "justify-center sm:p-7 lg:px-9 lg:py-8" : "sm:p-6",
          )}
        >
          <p className="kicker">{topicName(video.topic)}</p>

          <h3
            className={cn(
              "font-display font-semibold tracking-tight text-balance",
              "transition-transform duration-normal ease-entrance",
              "group-hover:translate-x-[3px] motion-reduce:transform-none",
              isFeature
                ? "mt-3 text-[1.6rem] leading-[1.12] sm:text-[1.9rem] lg:text-[2.3rem]"
                : "mt-2.5 flex-1 text-lg leading-[1.2] sm:text-xl",
            )}
          >
            {video.title}
          </h3>

          <div
            className={cn(
              "flex items-center gap-3 border-t border-border pt-4 text-[13px] text-muted-foreground",
              isFeature ? "mt-7" : "mt-5",
            )}
          >
            <span>{publishedLabel(video.published)}</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="tabular-nums">{formatCompact(video.views)} views</span>
            <ArrowUpRight
              className="nudge-x ml-auto h-4 w-4 transition-colors group-hover:text-accent"
              aria-hidden
            />
          </div>
        </div>
      </Link>

      {/* The same corner cluster as the story card, for the same reasons —
          outside the <a> so neither press navigates, revealed on hover where
          there is a pointer, permanently visible below `md` where there is
          not. Reports were the half of the work you could not share without
          opening first, which is the wrong way round: a listing is where
          somebody decides which one to send to a friend. */}
      <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity duration-normal focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        <BookmarkButton itemId={`video:${video.id}`} title={video.title} variant="floating" />
        <ShareButton title={video.title} path={`/videos/${video.id}`} variant="floating" />
      </div>
    </Reveal>
  );
}
