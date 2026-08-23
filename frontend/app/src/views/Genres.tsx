"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { VIDEOS, videoBeat } from "@/data/videos";
import { TOP_BEATS, childBeats, inGenre, storiesByGenre } from "@/data/content";
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
 * ── Two levels, six sections ─────────────────────────────────────────────
 * The taxonomy is a tree: six beats, each with the specific subjects beneath
 * it. Only the six get a section, because twenty-one headings is an index and
 * not a page. Inside a section the children appear twice — once as the chip
 * row under the description, which names the whole beat's ground whether or
 * not anything is published on it yet, and again as a sub-heading above their
 * own work when they have some. A child with nothing filed under it is a chip
 * and nothing more: it is a subject he covers, not a promise of an article.
 */
export default function Genres() {
  return (
    <>
      <PageHero
        label="Beats"
        title="What I cover"
        lead="Everything filed under each subject is below — reports and writing together. The filmed work centres on his college; the writing ranges wider."
        rail={<PillNav items={TOP_BEATS.map((g) => ({ label: g.name, href: `#${g.slug}` }))} />}
      />

      {TOP_BEATS.map((topic, index) => {
        // Videos file against the channel's own four topics, so they reach a
        // beat through `videoBeat` rather than by matching the slug.
        const videos = VIDEOS.filter((video) => inGenre(videoBeat(video), topic.slug));
        // The whole family: pieces filed on the beat itself and on anything
        // under it. Split below so each child can carry its own heading.
        const written = storiesByGenre(topic.slug);
        const children = childBeats(topic.slug);
        const onParent = written.filter((story) => story.genre === topic.slug);

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
                    Beat {index + 1} of {TOP_BEATS.length}
                  </p>
                  <h2 className="font-display display-2 mt-3 font-semibold text-balance">
                    {/* The heading is the link to the beat's own page. This
                        screen is the hub — everything on one scroll — and the
                        subject pages are what a search result should land on,
                        so every beat named here points at its own address. */}
                    <Link href={`/beats/${topic.slug}`} className="focus-ring underline-grow">
                      {topic.name}
                    </Link>
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

              {/* The ground this beat covers. A chip with work behind it is a
                  link into the archive filtered to that subject; one without
                  is deliberately not a link, because a filter that lands on
                  an empty page is worse than no filter at all. */}
              {children.length > 0 && (
                <ul className="mt-7 flex flex-wrap items-center gap-2">
                  {children.map((child) => {
                    const count = storiesByGenre(child.slug).length;
                    return (
                      <li key={child.slug}>
                        {count > 0 ? (
                          <Link
                            href={`/beats/${child.slug}`}
                            className="surface-compact focus-ring tap inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-normal hover:border-accent/50 hover:text-primary"
                          >
                            {child.name}
                            <span className="tabular-nums text-muted-foreground">{count}</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-dashed border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
                            {child.name}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
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
                video. It is not any more: most beats have no video at all, and
                on those the compact rows were the entire section, so the page
                showed a heading, two counts and a list where every other beat
                showed work. Same card, same weight. */}
            {onParent.length > 0 && (
              <div className={videos.length > 0 ? "mt-14" : "mt-10"}>
                {videos.length > 0 && <p className="rule-label mb-6">Written on this beat</p>}
                <Stagger className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {onParent.map((story, i) => (
                    <StaggerItem key={story.id} index={i}>
                      <StoryCard story={story} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )}

            {/* One block per child that has work, each addressable on its own
                — `/genres#science-conservation` is the page for that subject,
                the same way the beat above it is. */}
            {children.map((child) => {
              const stories = storiesByGenre(child.slug);
              if (stories.length === 0) return null;

              return (
                <div key={child.slug} id={child.slug} className="mt-14 scroll-mt-28">
                  <Reveal variant="fade-up">
                    <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-6">
                      <div className="min-w-0">
                        <p className="rule-label">{topic.name}</p>
                        <h3 className="font-display display-3 mt-2 font-semibold text-balance">
                          <Link href={`/beats/${child.slug}`} className="focus-ring underline-grow">
                            {child.name}
                          </Link>
                        </h3>
                        <p className="mt-3 max-w-[56ch] leading-relaxed text-muted-foreground">
                          {child.description}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <span className="font-display text-base text-primary">
                          {stories.length}
                        </span>{" "}
                        {stories.length === 1 ? "piece" : "pieces"}
                      </p>
                    </div>
                  </Reveal>

                  <Stagger className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                    {stories.map((story, i) => (
                      <StaggerItem key={story.id} index={i}>
                        <StoryCard story={story} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              );
            })}
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
