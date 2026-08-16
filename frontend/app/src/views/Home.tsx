"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Youtube } from "lucide-react";
import { PROFILE, publishedStories } from "@/data/content";
import { CHANNEL, TOPICS, VIDEOS, longFormVideos, posterFor, totalViews } from "@/data/videos";
import { formatCompact } from "@/lib/format";
import {
  HeroSequence,
  Parallax,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/motion";
import { VideoCard } from "@/components/video/VideoCard";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/SectionHeading";
import { CurvedMarquee, SpecularButton, SpringCountUp } from "@/components/reactbits";

export default function Home() {
  const router = useRouter();
  const videos = longFormVideos();
  const [lead, ...rest] = videos;
  const written = publishedStories();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────
          One GSAP timeline drives the whole entrance; elements opt in
          with data-seq. Nothing here blocks interaction. */}
      <HeroSequence>
        <section className="honeycomb honeycomb-strong honeycomb-fade relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
          <div data-seq="texture" className="aurora absolute inset-0 -z-10" aria-hidden />

          <div className="container-site">
            {/* Asymmetric on purpose: the column split is 1.15/1 and the
                poster hangs below the baseline of the text column, so the two
                halves interlock rather than sitting in matching boxes. */}
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
                  {/* One specular button on the whole site. Each instance owns
                      a WebGL context, so it is spent on the single action the
                      hero exists to offer. */}
                  <div data-seq="cta">
                    <SpecularButton onClick={() => router.push("/videos")}>
                      Watch the reports
                    </SpecularButton>
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
              {/* Offset with margin, not a translate: `Parallax` drives this
                  element's transform from GSAP, and a Tailwind translate on
                  the same node gets overwritten on the first scroll tick. */}
              <Parallax amount={22} className="relative lg:mt-10">
                {/* A hex plate offset behind the poster. It is the honeycomb
                    motif at object scale — the same shape as the ground
                    texture, used once, large, so the two read as one idea. */}
                <span
                  data-seq="decor"
                  aria-hidden
                  className="absolute -right-5 -top-6 hidden h-28 w-24 bg-brand-sky/25 lg:block"
                  style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                />
                <Link
                  href={lead ? `/videos/${lead.id}` : "/videos"}
                  data-seq="image"
                  className="group focus-ring relative block aspect-[4/5] overflow-hidden rounded-lg bg-brand-ink-deep shadow-floating ring-1 ring-white/40"
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
                  className="glass-chip absolute -bottom-4 -left-4 text-primary shadow-floating"
                >
                  {CHANNEL.videoCount} reports published
                </div>
              </Parallax>
            </div>

            <div
              data-seq="decor"
              className="mt-24 flex items-center gap-6 border-t border-border pt-6 lg:mt-32"
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

        {/* Broken grid: the first two after the lead run wide, the rest fall
            into thirds. A uniform 3×N wall of thumbnails reads as a catalogue;
            an editorial page should say which pieces matter most. */}
        <Stagger className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-6" step="normal">
          {rest.map((video, i) => (
            <StaggerItem
              key={video.id}
              index={i}
              className={i < 2 ? "lg:col-span-3" : "lg:col-span-2"}
            >
              <VideoCard video={video} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Curved band ──────────────────────────────────────────
          A section break with a voice. It names what the reporting covers
          and doubles as the hinge between the video grid and the beats,
          which is a job a horizontal rule cannot do. */}
      <section className="mt-24 overflow-hidden border-y border-border py-4">
        <CurvedMarquee
          text="Campus reporting · Kenyan culture · Student life · Features · "
          speed={1.2}
          curveAmount={260}
        />
      </section>

      {/* ── Beats ────────────────────────────────────────────────── */}
      <section className="container-site mt-28 lg:pb-10">
        <SectionHeading
          label="Beats"
          title="What I cover"
          action={{ href: "/genres", label: "Every beat" }}
        />
        {/* Comb rhythm: the tiles are separate raised cards and every second
            one drops half a step, so the row interlocks the way cells in a
            honeycomb do instead of sitting on one flat baseline. The offset
            is desktop-only — on a phone the column is the layout. */}
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" step="tight">
          {TOPICS.map((topic, i) => (
            <StaggerItem key={topic.slug} index={i}>
              <Reveal variant="fade-up" distance="sm" className="h-full">
                <Link
                  href={`/videos?topic=${topic.slug}`}
                  className={
                    "surface surface-hover group focus-ring relative flex h-full flex-col overflow-hidden p-6 " +
                    (i % 2 === 1 ? "lg:translate-y-7" : "")
                  }
                >
                  <span
                    aria-hidden
                    className="absolute -right-6 -top-6 h-20 w-16 bg-accent/8 transition-colors duration-slow group-hover:bg-accent/16"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    }}
                  />
                  <p className="font-display relative text-xl font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
                    {topic.name}
                  </p>
                  <p className="relative mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {topic.description}
                  </p>
                  <ArrowUpRight
                    className="nudge-x relative mt-5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
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

            {/* Three raised plates rather than one hairline-divided block —
                the middle one sits proud, so the row has a centre. */}
            <div className="grid grid-cols-3 gap-3 self-start sm:gap-4">
              {[
                { value: CHANNEL.videoCount, label: "Reports" },
                { value: totalViews(), label: "Total views" },
                { value: CHANNEL.subscribers, label: "Subscribers" },
              ].map((stat, i) => (
                <Reveal
                  key={stat.label}
                  variant="fade-up"
                  delay={i * 70}
                  className={
                    "surface honeycomb honeycomb-strong overflow-hidden p-4 sm:p-5 " +
                    (i === 1 ? "sm:-translate-y-4 sm:shadow-lifted" : "")
                  }
                >
                  <p className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                    <SpringCountUp to={stat.value} />
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
