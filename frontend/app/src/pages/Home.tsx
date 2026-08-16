"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Youtube } from "lucide-react";
import { PROFILE, publishedStories } from "@/data/content";
import { CHANNEL, TOPICS, VIDEOS, longFormVideos, posterFor, totalViews } from "@/data/videos";
import { formatCompact } from "@/lib/format";
import {
  CountUp,
  HeroSequence,
  Magnetic,
  Parallax,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/motion";
import { VideoCard } from "@/components/video/VideoCard";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/SectionHeading";

export default function Home() {
  const videos = longFormVideos();
  const [lead, ...rest] = videos;
  const written = publishedStories();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────
          One GSAP timeline drives the whole entrance; elements opt in
          with data-seq. Nothing here blocks interaction. */}
      <HeroSequence>
        <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
          <div data-seq="texture" className="aurora absolute inset-0 -z-10" aria-hidden />

          <div className="container-site">
            <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_1fr]">
              <div>
                <p data-seq="eyebrow" className="kicker">
                  Journalist · {PROFILE.base}
                </p>

                <h1 className="font-display mt-4 text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-6xl lg:text-[4.2rem]">
                  {["Reporting from", "the ground,", "one story at a time."].map((line) => (
                    <span key={line} className="block overflow-hidden pb-[0.06em]">
                      <span data-seq="headline" className="block">
                        {line}
                      </span>
                    </span>
                  ))}
                </h1>

                <p
                  data-seq="support"
                  className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground"
                >
                  I'm {PROFILE.name}, a journalist and {PROFILE.education} graduate. I report on
                  campus systems, Kenyan culture and student life — and publish it as video on{" "}
                  {CHANNEL.handle}. Every report plays right here.
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <div data-seq="cta">
                    <Magnetic>
                      <Button as={Link} href="/videos" size="lg" className="group">
                        Watch the reports
                        <ArrowRight className="nudge-x h-4 w-4" aria-hidden />
                      </Button>
                    </Magnetic>
                  </div>
                  <div data-seq="cta">
                    <Button
                      as="a"
                      href={CHANNEL.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      size="lg"
                      variant="outline"
                    >
                      <Youtube className="h-4 w-4" aria-hidden />
                      Subscribe
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lead poster: masked reveal, then a few px of parallax as it
                  scrolls. Enough to feel dimensional, not enough to notice. */}
              <Parallax amount={22} className="relative">
                <Link
                  href={lead ? `/video/${lead.id}` : "/videos"}
                  data-seq="image"
                  className="group focus-ring relative block aspect-[4/5] overflow-hidden rounded-sm bg-brand-ink-deep"
                >
                  {lead && (
                    <img
                      src={posterFor(lead.id)}
                      alt=""
                      className="media-zoom h-full w-full object-cover"
                    />
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-brand-ink-deep/85 via-brand-ink-deep/10 to-transparent"
                  />
                  {lead && (
                    <span className="absolute inset-x-0 bottom-0 p-5">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-sky">
                        Latest report
                      </span>
                      <span className="font-display mt-1.5 block text-lg font-semibold leading-snug text-white">
                        {lead.title}
                      </span>
                    </span>
                  )}
                </Link>

                <div
                  data-seq="decor"
                  className="glass-chip absolute -bottom-4 -left-4 text-primary shadow-lg"
                >
                  {CHANNEL.videoCount} reports published
                </div>
              </Parallax>
            </div>

            <div
              data-seq="decor"
              className="mt-20 flex items-center gap-6 border-t border-border pt-6"
            >
              <span className="rule-label">Scroll</span>
              <span aria-hidden className="animate-scrollpulse h-8 w-px bg-accent" />
              <span className="ml-auto text-xs text-muted-foreground">
                {formatCompact(totalViews())} views across {VIDEOS.length} pieces
              </span>
            </div>
          </div>
        </section>
      </HeroSequence>

      {/* ── Reports ──────────────────────────────────────────────── */}
      <section className="container-site mt-8">
        <SectionHeading
          label="Selected work"
          title="Recent reports"
          action={{ href: "/videos", label: "All reports" }}
        />

        {lead && (
          <div className="mt-12">
            <VideoCard video={lead} variant="feature" />
          </div>
        )}

        <Stagger className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" step="normal">
          {rest.map((video, i) => (
            <StaggerItem key={video.id} index={i}>
              <VideoCard video={video} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Beats ────────────────────────────────────────────────── */}
      <section className="container-site mt-28">
        <SectionHeading
          label="Beats"
          title="What I cover"
          action={{ href: "/genres", label: "Every beat" }}
        />
        <Stagger className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4" step="tight">
          {TOPICS.map((topic, i) => (
            <StaggerItem key={topic.slug} index={i}>
              <Reveal variant="fade-up" distance="sm">
                <Link
                  href={`/videos?topic=${topic.slug}`}
                  className="group focus-ring block h-full bg-background p-6 transition-colors duration-normal hover:bg-secondary/60"
                >
                  <p className="font-display text-xl font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
                    {topic.name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {topic.description}
                  </p>
                  <ArrowUpRight
                    className="nudge-x mt-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
                    aria-hidden
                  />
                </Link>
              </Reveal>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Written work ─────────────────────────────────────────── */}
      {written.length > 0 && (
        <section className="container-site mt-28">
          <SectionHeading
            label="In writing"
            title="Read or listen"
            description="Written pieces can be read on the page or played aloud, with the paragraph being spoken highlighted as it goes."
            action={{ href: "/stories", label: "All writing" }}
          />
          <Stagger className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {written.map((story, i) => (
              <StaggerItem key={story.id} index={i}>
                <StoryCard story={story} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* ── Channel ──────────────────────────────────────────────── */}
      <section className="container-site mt-28">
        <Reveal variant="fade-up" className="border-t border-border pt-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="rule-label">The channel</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {CHANNEL.name}
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                New reports are published on YouTube first. Subscribing is the fastest way to see
                them.
              </p>
              <Button
                as="a"
                href={CHANNEL.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-7"
              >
                <Youtube className="h-4 w-4" aria-hidden />
                Subscribe on YouTube
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-px self-start bg-border">
              {[
                { value: CHANNEL.videoCount, label: "Reports" },
                { value: totalViews(), label: "Total views" },
                { value: CHANNEL.subscribers, label: "Subscribers" },
              ].map((stat, i) => (
                <Reveal key={stat.label} variant="fade-up" delay={i * 70} className="bg-background p-5">
                  <p className="font-display text-3xl font-semibold tracking-tight text-primary">
                    <CountUp value={stat.value} />
                  </p>
                  <p className="rule-label mt-1.5">{stat.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
