"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, GraduationCap, MapPin, Youtube } from "lucide-react";
import { PROFILE, publishedStories } from "@/data/content";
import { CHANNEL, TOPICS, longFormVideos, totalViews } from "@/data/videos";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  HeroSequence,
  ImageReveal,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/motion";
import { VideoCard } from "@/components/video/VideoCard";
import { VideoPoster } from "@/components/video/VideoPoster";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/SectionHeading";
import { HeroBadge, HeroPanel } from "@/components/hero/HeroPanel";
import { HeroNote } from "@/components/hero/HeroNote";
import { LeadMark } from "@/components/hero/PageHero";
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
        <HeroPanel>
          <div data-seq="texture" className="aurora absolute inset-0 -z-10 opacity-70" aria-hidden />

          {/* Centred composition: badge, headline, serif subhead, two actions,
              then a chip rail on hairlines. The reference's structure, in our
              palette and type. */}
          <div className="container-site flex flex-col items-center text-center">
            <div data-seq="eyebrow">
              <HeroBadge icon={<Youtube className="h-3.5 w-3.5" aria-hidden />}>
                {CHANNEL.videoCount} reports · {formatCompact(totalViews())} views
              </HeroBadge>
            </div>

            <h1 className="font-display display-1 mt-7 font-semibold text-balance">
              {["Reporting from the ground,", "one story at a time."].map((line) => (
                <span key={line} className="block overflow-hidden pb-[0.16em]">
                  <span data-seq="headline" className="block">
                    {line}
                  </span>
                </span>
              ))}
            </h1>

            {/* Serif subhead with the keywords marked — the promise, not a
                second headline. */}
            <p
              data-seq="support"
              className="font-display lead-copy mx-auto mt-7 max-w-[52ch] text-muted-foreground"
            >
              {PROFILE.name} reports on <LeadMark>campus systems</LeadMark>,{" "}
              <LeadMark>Kenyan culture</LeadMark> and <LeadMark>student life</LeadMark> — published
              as video, and readable or listenable here.
            </p>

            <div className="relative mt-10 flex w-full flex-wrap items-center justify-center gap-3">
              <HeroNote direction="down-right" className="absolute -left-2 -top-4 xl:left-8">
                Every report plays right here
              </HeroNote>

              {/* One specular button on the whole site. Each instance owns a
                  WebGL context, so it is spent on the single action the hero
                  exists to offer. */}
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

              <HeroNote direction="down-left" className="absolute -right-2 -top-4 xl:right-8">
                Nothing loads from YouTube until you press play
              </HeroNote>
            </div>

            {/* The beats, on hairlines — real links, not decoration. */}
            <div data-seq="decor" className="rail mt-14 w-full">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {TOPICS.map((topic) => (
                  <Link
                    key={topic.slug}
                    href={`/videos?topic=${topic.slug}`}
                    className="surface-compact focus-ring tap inline-flex items-center rounded-full px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-normal hover:border-accent/50 hover:text-primary sm:h-8"
                  >
                    {topic.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Showcase: posters rising out of the panel's bottom edge, clipped
              by it. The middle card stands tallest so the row has a centre,
              and the whole group is decorative — every one of these reports is
              reachable from the grid directly below. */}
          <div data-seq="image" className="container-site mt-16 grid grid-cols-3 gap-3 sm:gap-5">
            {videos.slice(0, 3).map((video, i) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                aria-label={video.title}
                className={cn(
                  "group focus-ring relative block overflow-hidden rounded-xl bg-brand-ink-deep",
                  "shadow-floating ring-1 ring-white/50",
                  "aspect-[3/4] sm:aspect-[4/5]",
                  // The middle card stands proud; the outer two drop, so the
                  // row has a centre without any of them being cropped.
                  i === 1 ? "sm:-translate-y-5" : "",
                )}
              >
                <VideoPoster id={video.id} priority className="media-zoom" />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-brand-ink-deep/80 via-transparent to-transparent"
                />
                <span className="absolute inset-x-0 bottom-0 hidden p-4 text-left sm:block">
                  <span className="font-display line-clamp-2 block text-sm font-semibold leading-snug text-white">
                    {video.title}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </HeroPanel>
      </HeroSequence>

      {/* ── Who is reporting ─────────────────────────────────────
          The person comes before the portfolio. A reader who has just
          landed needs to know who is telling them this and what
          qualifies them to, before a grid of thumbnails asks them to
          spend twenty minutes. Every fact here is one we hold. */}
      <section className="container-site mt-20 sm:mt-24">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-16">
          <Reveal variant="fade-up">
            <ImageReveal
              src="/images/channels4_profile.jpg"
              alt={`${PROFILE.name}, ${PROFILE.role}`}
              ratio="1/1"
              className="mx-auto max-w-[260px] rounded-2xl shadow-primary lg:mx-0"
              imgClassName="object-cover"
            />
          </Reveal>

          <div>
            <Reveal variant="fade-up" delay={60}>
              <p className="rule-label">The journalist</p>
              <h2 className="font-display display-2 mt-3 font-semibold text-balance">
                {PROFILE.name}
              </h2>
              <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
                A {PROFILE.role.toLowerCase()} based in {PROFILE.base} and a{" "}
                {PROFILE.education} graduate. The reporting starts with what an institution
                actually does, then asks the people it affects — and it is published as video,
                first, on {CHANNEL.handle}.
              </p>
            </Reveal>

            {/* The facts, as a list of facts. Nothing here is inferred. */}
            <Stagger
              className="mt-9 grid gap-3 sm:grid-cols-3"
              step="tight"
            >
              {[
                { icon: MapPin, label: "Based in", value: PROFILE.base },
                { icon: GraduationCap, label: "Studied at", value: PROFILE.education },
                { icon: Youtube, label: "Publishes on", value: CHANNEL.handle },
              ].map((fact, i) => (
                <StaggerItem key={fact.label} index={i}>
                  <Reveal variant="fade-up" distance="sm" className="surface-compact h-full p-4">
                    <fact.icon className="h-4 w-4 text-accent" aria-hidden />
                    <p className="rule-label mt-3">{fact.label}</p>
                    <p className="font-display mt-1 text-[15px] font-semibold leading-snug">
                      {fact.value}
                    </p>
                  </Reveal>
                </StaggerItem>
              ))}
            </Stagger>

            {/* Reach, from the channel's own recorded figures. */}
            <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { value: CHANNEL.videoCount, label: "Reports" },
                { value: totalViews(), label: "Total views" },
                { value: CHANNEL.subscribers, label: "Subscribers" },
              ].map((stat, i) => (
                <Reveal
                  key={stat.label}
                  variant="fade-up"
                  delay={i * 70}
                  className={cn(
                    "surface honeycomb honeycomb-strong overflow-hidden p-4 sm:p-5",
                    // The middle plate sits proud so the row has a centre.
                    i === 1 && "sm:-translate-y-3",
                  )}
                >
                  <p className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                    <SpringCountUp to={stat.value} />
                  </p>
                  <p className="rule-label mt-1.5">{stat.label}</p>
                </Reveal>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} href="/about" variant="outline">
                More about {PROFILE.name.split(" ")[0]}
                <ArrowUpRight className="nudge-x h-4 w-4" aria-hidden />
              </Button>
              <Button as={Link} href="/contact" variant="ghost">
                Send a tip
              </Button>
            </div>
          </div>
        </div>
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

      {/* ── Reports ──────────────────────────────────────────────── */}
      <section className="container-site mt-24">
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
          curveAmount={90}
        />
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

            {/* The counts now live with the journalist further up the page,
                where they read as his record rather than as a metrics panel.
                What belongs here is the newest work and a way to follow it. */}
            <div className="grid grid-cols-2 gap-3 self-start sm:gap-4">
              {videos.slice(0, 2).map((video) => (
                <Link
                  key={video.id}
                  href={`/videos/${video.id}`}
                  className="group focus-ring surface surface-hover overflow-hidden"
                >
                  <span className="relative block aspect-video overflow-hidden bg-brand-ink-deep">
                    <VideoPoster id={video.id} className="media-zoom" />
                  </span>
                  <span className="block p-4">
                    <span className="font-display line-clamp-2 block text-sm font-semibold leading-snug">
                      {video.title}
                    </span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {formatCompact(video.views)} views
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
