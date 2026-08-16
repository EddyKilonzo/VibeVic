"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TOPICS, posterFor, videosByTopic } from "@/data/videos";
import { storiesByGenre } from "@/data/content";
import { ImageReveal } from "@/components/motion";
import { GooeyNav, ScrollStack, ScrollStackItem } from "@/components/reactbits";
import { PageHero } from "@/components/hero/PageHero";

export default function Genres() {
  return (
    <>
      {/* The jump nav lives in the hero rail. Each beat has an anchor further
          down the page, so this is real navigation rather than a decorative
          row — which is the only reason it earns an effect this loud. */}
      <PageHero
        label="Beats"
        title="What I cover"
        lead="Four beats, one method: start with what the institution actually does, then ask the people it affects."
        rail={<GooeyNav items={TOPICS.map((t) => ({ label: t.name, href: `#${t.slug}` }))} />}
      />

      <div className="container-site">
      {/* Each beat is a page that pins and stacks as the next arrives — the
          four subjects are an ordered, finite set, which is the shape this
          reads well at. Under reduced motion it falls back to a plain column,
          because the sequence *is* the effect. */}
      <ScrollStack className="mt-14">
        {TOPICS.map((topic) => {
          const videos = videosByTopic(topic.slug);
          const written = storiesByGenre(topic.slug);
          const lead = videos[0];

          return (
            <ScrollStackItem key={topic.slug} className="surface p-6 sm:p-8">
              <section id={topic.slug} className="scroll-mt-28">
                <Link
                  href={`/videos?topic=${topic.slug}`}
                  className="group focus-ring grid items-center gap-6 sm:grid-cols-[200px_1fr_auto]"
                >
                  {lead ? (
                    <ImageReveal
                      src={posterFor(lead.id)}
                      fallbackSrc={posterFor(lead.id, "hq")}
                      alt=""
                      ratio="3/2"
                      hoverZoom
                      className="rounded-lg shadow-card"
                    />
                  ) : (
                    <div className="aspect-[3/2] rounded-lg bg-muted shadow-card" />
                  )}

                  <div className="min-w-0">
                    <h2 className="font-display display-3 font-semibold transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
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
              </section>
            </ScrollStackItem>
          );
        })}
      </ScrollStack>
      </div>
    </>
  );
}
