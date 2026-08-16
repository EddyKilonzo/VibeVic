"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TOPICS, posterFor, videosByTopic } from "@/data/videos";
import { storiesByGenre } from "@/data/content";
import { ImageReveal, Reveal, Stagger, StaggerItem } from "@/components/motion";

export default function Genres() {
  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Beats</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          What I cover
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Four beats, one method: start with what the institution actually does, then ask the
          people it affects.
        </p>
      </Reveal>

      <Stagger className="mt-16 space-y-px" step="normal">
        {TOPICS.map((topic, i) => {
          const videos = videosByTopic(topic.slug);
          const written = storiesByGenre(topic.slug);
          const lead = videos[0];

          return (
            <StaggerItem key={topic.slug} index={i}>
              <Reveal variant="fade-up" as="section">
                <Link
                  id={topic.slug}
                  href={`/videos?topic=${topic.slug}`}
                  className="group focus-ring grid scroll-mt-28 items-center gap-6 border-t border-border py-8 transition-colors duration-normal hover:border-primary sm:grid-cols-[180px_1fr_auto]"
                >
                  {lead ? (
                    <ImageReveal
                      src={posterFor(lead.id)}
                      alt=""
                      ratio="3/2"
                      hoverZoom
                      className="rounded-sm"
                    />
                  ) : (
                    <div className="aspect-[3/2] rounded-sm bg-muted" />
                  )}

                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none sm:text-3xl">
                      {topic.name}
                    </h2>
                    <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
                      {topic.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
                    <span className="font-display text-3xl font-semibold tabular-nums text-primary">
                      {videos.length}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {videos.length === 1 ? "report" : "reports"}
                      {written.length > 0 && ` · ${written.length} written`}
                      <ArrowUpRight
                        className="nudge-x h-4 w-4 transition-colors group-hover:text-accent"
                        aria-hidden
                      />
                    </span>
                  </div>
                </Link>
              </Reveal>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
