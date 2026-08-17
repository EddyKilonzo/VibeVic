"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { VIDEOS } from "@/data/videos";
import { GENRES, storiesByGenre } from "@/data/content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { VideoCard } from "@/components/video/VideoCard";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";
import { PillNav } from "@/components/reactbits";
import { PageHero } from "@/components/hero/PageHero";

/**
 * The subject index.
 *
 * ── What this page is for ────────────────────────────────────────────────
 * It used to be four cards that each linked to `/videos?topic=…`, which made
 * it a menu in front of another page — a click the reader had to spend to get
 * somewhere they could have gone directly from the nav. So it does the actual
 * job instead: everything filed under a beat, on one screen, with the reports
 * and the written pieces together.
 *
 * That is the split with `/videos`, and it is worth stating because the two
 * pages hold the same reports:
 *
 *   /videos   the feed — every report, newest first, filterable.
 *   /genres   the subject — one beat at a time, video *and* writing, which
 *             the video archive cannot show because it only holds video.
 *
 * The pills in the hero jump between the sections below rather than
 * navigating away, so the nav is the page's table of contents.
 *
 * ── It runs on genres, not on video topics ───────────────────────────────
 * It used to iterate the four video topics, which meant that the moment the
 * written archive arrived, three whole beats — science and health, the
 * environment, politics — existed in the filters on `/stories` and were
 * invisible on the page whose entire job is to show what he covers. Reading
 * from `GENRES` means a subject appears here because work exists under it,
 * whether that work is filmed or written.
 */
export default function Genres() {
  return (
    <>
      <PageHero
        label="Beats"
        title="What I cover"
        lead="Everything filed under each subject is below — reports and writing together. The filmed work centres on his college; the writing ranges wider."
        rail={<PillNav items={GENRES.map((g) => ({ label: g.name, href: `#${g.slug}` }))} />}
      />

      {GENRES.map((topic, index) => {
        // Compared as plain strings: the written-only genres are not video
        // topics, so this is legitimately empty for three of the seven.
        const videos = VIDEOS.filter((video) => video.topic === topic.slug);
        const written = storiesByGenre(topic.slug);

        return (
          <section
            key={topic.slug}
            id={topic.slug}
            className="container-site mt-20 scroll-mt-28 sm:mt-24"
          >
            <Reveal variant="fade-up" className="border-t border-border pt-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="rule-label">
                    Beat {index + 1} of {GENRES.length}
                  </p>
                  <h2 className="font-display display-2 mt-3 font-semibold text-balance">
                    {topic.name}
                  </h2>
                  <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-muted-foreground">
                    {topic.description}
                  </p>
                </div>

                {/* Real counts, from the archive — not a badge for the sake of
                    one. Both halves are named because a beat with three
                    reports and no writing is a different thing from a beat
                    with one of each. */}
                <div className="flex shrink-0 gap-6 sm:gap-8">
                  <div>
                    <p className="font-display text-3xl font-semibold tabular-nums leading-none text-primary sm:text-4xl">
                      {videos.length}
                    </p>
                    <p className="rule-label mt-1.5">
                      {videos.length === 1 ? "report" : "reports"}
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-3xl font-semibold tabular-nums leading-none text-primary sm:text-4xl">
                      {written.length}
                    </p>
                    <p className="rule-label mt-1.5">
                      {written.length === 1 ? "written piece" : "written pieces"}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            {videos.length > 0 ? (
              <Stagger className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video, i) => (
                  <StaggerItem key={video.id} index={i}>
                    <VideoCard video={video} />
                  </StaggerItem>
                ))}
              </Stagger>
            ) : (
              written.length === 0 && (
                <Reveal
                  variant="fade-up"
                  className="surface mt-10 border-dashed p-8 text-center text-muted-foreground"
                >
                  <p className="leading-relaxed">
                    Nothing filed under this beat yet. It is a subject he covers, not a promise
                    that something is already published.
                  </p>
                </Reveal>
              )
            )}

            {/* Full cards, on the same grid as the reports above.
                These used to be compact list rows — a date, a title, a line of
                metadata — which was fine when writing was a footnote to the
                video. It is not any more: three of the seven beats have no
                video at all, and on those the compact rows were the entire
                section, so the page showed a heading, two counts and a list
                where every other beat showed work. Same card, same weight. */}
            {written.length > 0 && (
              <div className={videos.length > 0 ? "mt-14" : "mt-10"}>
                {videos.length > 0 && <p className="rule-label mb-6">Written on this beat</p>}
                <Stagger className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {written.map((story, i) => (
                    <StaggerItem key={story.id} index={i}>
                      <StoryCard story={story} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )}
          </section>
        );
      })}

      <section className="container-site mt-24">
        <Reveal
          variant="fade-up"
          className="surface honeycomb honeycomb-strong flex flex-col gap-6 overflow-hidden p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10"
        >
          <div>
            <p className="rule-label">Not by subject</p>
            <h2 className="font-display display-3 mt-3 font-semibold text-balance">
              Everything, newest first.
            </h2>
            <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
              This page groups the work by what it is about. The archive lists it by when it was
              published.
            </p>
          </div>
          <Button as={Link} href="/videos" className="shrink-0 self-start sm:self-auto">
            All reports
            <ArrowUpRight className="nudge-x h-4 w-4" aria-hidden />
          </Button>
        </Reveal>
      </section>
    </>
  );
}
