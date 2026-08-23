"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Genre } from "@/data/types";
import { VIDEOS, videoBeat } from "@/data/videos";
import { childBeats, inGenre, parentBeat, storiesByGenre } from "@/data/content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { VideoCard } from "@/components/video/VideoCard";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/hero/PageHero";

/**
 * One beat, at its own address.
 *
 * ── Why these pages exist ────────────────────────────────────────────────
 * `/genres` shows every beat on one screen, which is the right page for a
 * reader browsing and the wrong one for everybody arriving from a search.
 * The sitemap used to list `/genres#news-kenya` and twenty siblings, and a
 * fragment is not an address — Google discards everything after the `#` and
 * files all twenty-one under one URL. So the subject a piece is about had no
 * page that could rank for it.
 *
 * This is that page. `/genres` stays as the hub and keeps its anchors; these
 * are the spokes, and they are what the footer, the home grid and every
 * story's kicker now link to.
 *
 * A parent shows its whole family — its own pieces and everything filed under
 * its children — because "News" means the reporting, not just the reporting
 * nobody filed more precisely. A child shows only itself.
 */
export default function Beat({ beat }: { beat: Genre }) {
  const parent = parentBeat(beat.slug);
  const children = childBeats(beat.slug);

  const videos = VIDEOS.filter((video) => inGenre(videoBeat(video), beat.slug));
  const stories = storiesByGenre(beat.slug);

  return (
    <>
      <PageHero
        label={parent ? `${parent.name} · beat` : "Beat"}
        title={beat.name}
        lead={beat.description}
      />

      <div className="container-site">
        {/* Up to the parent, or down to the children — either way the reader
            and the crawler can walk the tree from any node in it. A subject
            page that is a dead end is a page Google sees once. */}
        {(parent || children.length > 0) && (
          <Reveal variant="fade-up" className="mt-10 flex flex-wrap items-center gap-2">
            {parent && (
              <Link
                href={`/beats/${parent.slug}`}
                className="surface-compact focus-ring tap inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-normal hover:border-accent/50 hover:text-primary"
              >
                ← All of {parent.name}
              </Link>
            )}
            {children.map((child) => {
              const count = storiesByGenre(child.slug).length;
              return (
                <Link
                  key={child.slug}
                  href={`/beats/${child.slug}`}
                  className="surface-compact focus-ring tap inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-normal hover:border-accent/50 hover:text-primary"
                >
                  {child.name}
                  {count > 0 && <span className="tabular-nums text-muted-foreground">{count}</span>}
                </Link>
              );
            })}
          </Reveal>
        )}

        {videos.length > 0 && (
          <section className="mt-14">
            <p className="rule-label">
              {videos.length} {videos.length === 1 ? "report" : "reports"}
            </p>
            <Stagger className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video, i) => (
                <StaggerItem key={video.id} index={i}>
                  <VideoCard video={video} />
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {stories.length > 0 && (
          <section className={videos.length > 0 ? "mt-20" : "mt-14"}>
            <p className="rule-label">
              {stories.length} written {stories.length === 1 ? "piece" : "pieces"}
            </p>
            <Stagger className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story, i) => (
                <StaggerItem key={story.id} index={i}>
                  <StoryCard story={story} />
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {/* An honest empty state, and deliberately not a soft 404: the beat is
            a subject he covers and the page says so, rather than pretending
            work exists or vanishing the subject from the site. */}
        {videos.length === 0 && stories.length === 0 && (
          <Reveal
            variant="fade-up"
            className="surface mt-14 border-dashed p-8 text-center text-muted-foreground"
          >
            <p className="leading-relaxed">
              Nothing filed under this beat yet. It is a subject he covers, not a promise that
              something is already published.
            </p>
          </Reveal>
        )}

        <section className="mt-24">
          <Reveal
            variant="fade-up"
            className="surface honeycomb honeycomb-strong flex flex-col gap-6 overflow-hidden p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10"
          >
            <div>
              <p className="rule-label">Every subject</p>
              <h2 className="font-display display-3 mt-3 font-semibold text-balance">
                The rest of the beats.
              </h2>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                Six subjects, and the specific ground inside each — reports and writing filed
                together.
              </p>
            </div>
            <Button as={Link} href="/genres" className="shrink-0 self-start sm:self-auto">
              All beats
              <ArrowUpRight className="nudge-x h-4 w-4" aria-hidden />
            </Button>
          </Reveal>
        </section>
      </div>
    </>
  );
}
