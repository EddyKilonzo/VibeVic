"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TOPICS, posterFor, videosByTopic } from "@/data/videos";
import { storiesByGenre } from "@/data/content";
import { formatCompact } from "@/lib/format";
import { ImageReveal } from "@/components/motion";
import { PillNav, ScrollStack, ScrollStackItem } from "@/components/reactbits";
import { PageHero } from "@/components/hero/PageHero";

export default function Genres() {
  return (
    <>
      {/* The jump nav lives in the hero rail. Each beat has an anchor further
          down the page, so this is real navigation rather than a decorative
          row. */}
      <PageHero
        label="Beats"
        title="What I cover"
        lead="Four beats, one method: start with what the institution actually does, then ask the people it affects."
        rail={<PillNav items={TOPICS.map((t) => ({ label: t.name, href: `#${t.slug}` }))} />}
      />

      <div className="container-site">
        {/* Each beat parks under the masthead and the next one slides over it,
            so the four read as a short, ordered sequence rather than a list —
            the page turn of a book, which is the shape a finite set of four
            subjects wants. Sticky positioning, so the page keeps one scroller
            and nothing captures the wheel. */}
        <ScrollStack className="mt-14 pb-8">
          {TOPICS.map((topic) => {
            const videos = videosByTopic(topic.slug);
            const written = storiesByGenre(topic.slug);
            const lead = videos[0];

            return (
              <ScrollStackItem key={topic.slug} className="surface overflow-hidden">
                <section id={topic.slug} className="scroll-mt-28">
                  <Link
                    href={`/videos?topic=${topic.slug}`}
                    className="group focus-ring grid gap-6 p-5 sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)] sm:gap-8 sm:p-7"
                  >
                    {lead ? (
                      <ImageReveal
                        src={posterFor(lead.id)}
                        fallbackSrc={posterFor(lead.id, "hq")}
                        alt=""
                        ratio="16/10"
                        hoverZoom
                        className="rounded-xl shadow-primary"
                      />
                    ) : (
                      <div className="aspect-[16/10] rounded-xl bg-muted shadow-primary" />
                    )}

                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-start justify-between gap-5">
                        {/* The whole card is the link, so the arrow sits with
                            the beat's name rather than as a separate line at
                            the card's foot — where the next card in the stack
                            would slide over it and cut it in half. */}
                        <h2 className="font-display display-3 inline-flex items-start gap-2 font-semibold transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
                          {topic.name}
                          <ArrowUpRight
                            className="nudge-x mt-1.5 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
                            aria-hidden
                          />
                        </h2>
                        <span className="shrink-0 text-right">
                          <span className="font-display block text-3xl font-semibold tabular-nums leading-none text-primary">
                            {videos.length}
                          </span>
                          <span className="rule-label mt-1 block">
                            {videos.length === 1 ? "report" : "reports"}
                            {written.length > 0 && ` · ${written.length} written`}
                          </span>
                        </span>
                      </div>

                      <p className="mt-3 max-w-[52ch] leading-relaxed text-muted-foreground">
                        {topic.description}
                      </p>

                      {/* The two most recent pieces on the beat, by name. A
                          count tells a reader how much there is; a title tells
                          them whether they want it. */}
                      {videos.length > 0 && (
                        <ul className="mt-5 space-y-2 border-t border-border pt-4">
                          {videos.slice(0, 2).map((video) => (
                            <li
                              key={video.id}
                              className="flex items-baseline gap-3 text-sm text-muted-foreground"
                            >
                              <span className="font-display line-clamp-1 flex-1 font-semibold text-foreground">
                                {video.title}
                              </span>
                              <span className="shrink-0 tabular-nums text-xs">
                                {formatCompact(video.views)} views
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

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
