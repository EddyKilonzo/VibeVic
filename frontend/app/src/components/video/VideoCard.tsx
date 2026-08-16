"use client";

import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { posterFor, topicName, type Video } from "@/data/videos";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";

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
    <Reveal variant="fade-up" as="article" className={cn("group", className)}>
      <Link
        href={`/video/${video.id}`}
        className="focus-ring press block"
        aria-label={`Watch ${video.title}`}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-sm bg-muted",
            video.format === "short" ? "aspect-[9/16]" : "aspect-video",
          )}
        >
          <img
            src={posterFor(video.id)}
            alt=""
            loading={isFeature ? "eager" : "lazy"}
            decoding="async"
            className="media-zoom absolute inset-0 h-full w-full object-cover"
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

        <p className="kicker mt-4">{topicName(video.topic)}</p>

        <h3
          className={cn(
            "font-display mt-2 font-semibold leading-[1.2] tracking-tight text-balance",
            "transition-transform duration-normal ease-entrance",
            "group-hover:translate-x-[3px] motion-reduce:transform-none",
            isFeature ? "text-2xl sm:text-4xl" : "text-lg sm:text-xl",
          )}
        >
          {video.title}
        </h3>

        <div className="mt-3 flex items-center gap-3 text-[13px] text-muted-foreground">
          <span>{publishedLabel(video.published)}</span>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span>{formatCompact(video.views)} views</span>
          <ArrowUpRight
            className="nudge-x ml-auto h-4 w-4 transition-colors group-hover:text-accent"
            aria-hidden
          />
        </div>
      </Link>
    </Reveal>
  );
}
