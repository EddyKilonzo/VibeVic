"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Share2, Youtube } from "lucide-react";
import {
  CHANNEL,
  relatedVideos,
  topicName,
  videoById,
  watchUrl,
} from "@/data/videos";
import { formatCompact } from "@/lib/format";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { VideoEmbed } from "@/components/video/VideoEmbed";
import { VideoCard, publishedLabel } from "@/components/video/VideoCard";
import { BookmarkButton } from "@/components/story/BookmarkButton";
import { ShareSheet } from "@/components/story/ShareSheet";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { SectionHeading } from "@/components/SectionHeading";

export default function Video() {
  const { id = "" } = useParams();
  const video = videoById(id);
  const [shareOpen, setShareOpen] = useState(false);

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

      {/* The player sits in a wider column than the text around it. */}
      <Reveal variant="fade-scale" delay={140}>
        <div
          className={
            video.format === "short"
              ? "mx-auto mt-10 w-full max-w-[380px] px-5"
              : "mx-auto mt-10 w-full max-w-[1000px] px-0 sm:px-8"
          }
        >
          <VideoEmbed video={video} priority />
        </div>
      </Reveal>

      <div className="container-site mt-8">
        <Reveal variant="fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <BookmarkButton itemId={`video:${video.id}`} title={video.title} variant="inline" />

            <button
              type="button"
              onClick={() => setShareOpen(true)}
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
        path={`/video/${video.id}`}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
