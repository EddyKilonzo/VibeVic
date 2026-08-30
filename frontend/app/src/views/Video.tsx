"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Share2, Youtube } from "lucide-react";
import {
  CHANNEL,
  relatedVideos,
  topicName,
  videoById,
  videosByTopic,
  watchUrl,
  type Video as VideoRecord,
} from "@/data/videos";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { VideoEmbed } from "@/components/video/VideoEmbed";
import { DockedPlayer } from "@/components/video/DockedPlayer";
import { VideoCard, publishedLabel } from "@/components/video/VideoCard";
import { BookmarkButton } from "@/components/story/BookmarkButton";
import { ShareSheet } from "@/components/story/ShareSheet";
import { useShare } from "@/hooks/useShare";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { SectionHeading } from "@/components/SectionHeading";

export default function Video({ id }: { id: string }) {
  const video = videoById(id);
  /*
   * Reports go through the same route articles do. This opened our own sheet
   * directly and never asked the platform, so on a phone sharing a report
   * gave you four networks in a web panel while sharing an article gave you
   * every app on the device. One hook, one behaviour.
   */
  const {
    share,
    sheetOpen: shareOpen,
    closeSheet: closeShare,
  } = useShare({
    // Called before the "no such report" branch below, because a hook cannot
    // be. The fallbacks are never shared from — that branch returns an error
    // state with no share control on it.
    title: video?.title ?? "",
    path: video ? `/videos/${video.id}` : "/videos",
  });
  const [playing, setPlaying] = useState(false);

  if (!video) {
    return (
      <div className="container-article pt-40">
        <ErrorState
          title="That report isn't here."
          description="The link may be wrong, or the video may have moved."
        />
        <div className="mt-8 text-center">
          <Button as={Link} href="/videos" variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All reports
          </Button>
        </div>
      </div>
    );
  }

  const related = relatedVideos(video);

  // The beat, newest first, and where this report sits in it.
  const beat = videosByTopic(video.topic);
  const index = beat.findIndex((item) => item.id === video.id);
  const position = index + 1;
  const newer = index > 0 ? beat[index - 1] : null;
  const older = index >= 0 && index < beat.length - 1 ? beat[index + 1] : null;

  return (
    <div className="pt-28 sm:pt-36">
      <div className="container-site">
        <Reveal variant="fade-up" distance="sm">
          <Link href={`/videos?topic=${video.topic}`} className="focus-ring kicker underline-grow">
            {topicName(video.topic)}
          </Link>
        </Reveal>

        <Reveal variant="fade-up" delay={60}>
          <h1 className="font-display mt-3 max-w-4xl text-[2rem] font-semibold leading-[1.12] tracking-tight text-balance sm:text-[2.9rem]">
            {video.title}
          </h1>
        </Reveal>

        <Reveal variant="fade-up" delay={110}>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Victor Kiplimo</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>{publishedLabel(video.published)}</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>{formatCompact(video.views)} views</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>{video.duration}</span>
          </div>
        </Reveal>
      </div>

      {/* The player sits in a wider column than the text around it, and stays
          with the viewer once they have started it — see `DockedPlayer`. */}
      <Reveal variant="fade-scale" delay={140}>
        <div
          className={
            video.format === "short"
              ? "mx-auto mt-10 w-full max-w-[380px] px-5"
              : "mx-auto mt-10 w-full max-w-[1000px] px-0 sm:px-8"
          }
        >
          <DockedPlayer video={video} playing={playing}>
            <VideoEmbed
              video={video}
              priority
              className="h-full w-full"
              onPlay={() => setPlaying(true)}
            />
          </DockedPlayer>
        </div>
      </Reveal>

      <div className="container-site mt-8">
        <Reveal variant="fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <BookmarkButton itemId={`video:${video.id}`} title={video.title} variant="inline" />

            <button
              type="button"
              onClick={share}
              className="focus-ring press inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold transition-colors duration-normal hover:border-primary hover:text-primary"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </button>

            <Button
              as="a"
              href={watchUrl(video.id)}
              target="_blank"
              rel="noreferrer noopener"
              variant="ghost"
              className="ml-auto"
            >
              <Youtube className="h-4 w-4" aria-hidden />
              Watch on YouTube
            </Button>
          </div>
        </Reveal>

        <Reveal variant="fade-up" delay={80} className="mt-10 border-t border-border pt-8">
          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            Published on{" "}
            <a
              href={CHANNEL.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-grow font-medium text-primary"
            >
              {CHANNEL.handle}
            </a>
            . Reporting by Victor Kiplimo.
          </p>
        </Reveal>

        {/* Where this report sits on its beat, and the two either side of it.
            A grid of "related" cards tells a viewer there is more; a position
            and a direction tells them what they have and have not seen, which
            is the difference between browsing and following a subject.

            "Newer" and "older" rather than "next" and "previous": the beat is
            ordered by publication date, and next/previous would imply a
            sequence the reporting does not claim to have. */}
        {beat.length > 1 && (
          <Reveal variant="fade-up" delay={120} className="mt-10 border-t border-border pt-8">
            <p className="rule-label">
              Report {position} of {beat.length} on {topicName(video.topic)}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {newer ? <BeatStep direction="Newer on this beat" video={newer} /> : <span />}
              {older && <BeatStep direction="Older on this beat" video={older} align="end" />}
            </div>
          </Reveal>
        )}
      </div>

      {related.length > 0 && (
        <section className="container-site mt-24">
          <SectionHeading
            label="More reporting"
            title="Related reports"
            action={{ href: "/videos", label: "All reports" }}
          />
          <Stagger className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, i) => (
              <StaggerItem key={item.id} index={i}>
                <VideoCard video={item} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      <ShareSheet
        title={video.title}
        path={`/videos/${video.id}`}
        open={shareOpen}
        onClose={closeShare}
      />
    </div>
  );
}

/** One step along a beat: the direction, the title, and its duration. */
function BeatStep({
  direction,
  video,
  align = "start",
}: {
  direction: string;
  video: VideoRecord;
  align?: "start" | "end";
}) {
  const Arrow = align === "end" ? ArrowRight : ArrowLeft;

  return (
    <Link
      href={`/videos/${video.id}`}
      className={cn(
        "surface surface-hover focus-ring group flex items-center gap-4 p-4 sm:p-5",
        align === "end" && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <Arrow
        className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="rule-label block">{direction}</span>
        <span className="font-display mt-1.5 line-clamp-2 block text-[15px] font-semibold leading-snug">
          {video.title}
        </span>
        <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
          {video.duration}
        </span>
      </span>
    </Link>
  );
}
