"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, GraduationCap, Headphones, MapPin, Youtube } from "lucide-react";
import { PROFILE, SOCIAL_ACCOUNTS, publishedStories } from "@/data/content";
import { AGAINST_WALL, PORTRAIT, SHOOTING, WITH_CAMERA } from "@/data/portraits";
import { SocialIcon } from "@/components/social/SocialIcon";
import { CHANNEL, TOPICS, longFormVideos, totalViews, videosByTopic } from "@/data/videos";
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
import { HeroPanel } from "@/components/hero/HeroPanel";
import { HeroNote } from "@/components/hero/HeroNote";
import { LeadMark } from "@/components/hero/PageHero";
import { CurvedMarquee, SpecularButton, SpringCountUp } from "@/components/reactbits";

/**
 * Bento spans for the report grid, on a twelve-column field.
 *
 * The cycle is 7·5 / 4·4·4 — a wide-and-narrow pair, then an even trio — so a
 * run of reports reads as composed rows instead of a catalogue. It repeats
 * every five, which means the layout holds at any length rather than looking
 * deliberate for the first row and arbitrary after it.
 *
 * `lg:` only. Below that the one- and two-column stacks are the layout, and
 * imposing spans on them buys nothing.
 */
function reportSpan(index: number): string {
  const position = index % 5;
  if (position === 0) return "lg:col-span-7";
  if (position === 1) return "lg:col-span-5";
  return "lg:col-span-4";
}

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
        <HeroPanel fitViewport>
          <div data-seq="texture" className="aurora absolute inset-0 -z-10 opacity-70" aria-hidden />

          {/* Centred composition: badge, headline, serif subhead, two actions,
              then a chip rail on hairlines. The reference's structure, in our
              palette and type. */}
          {/* The counts used to sit in a badge above the headline. They are
              already stated further down, on the plates beside the biography,
              where they read as his record rather than as a metric bar — and
              opening a portfolio with a view count puts the smallest number on
              the page first. */}
          <div className="container-site flex flex-col items-center text-center">
            <h1 className="font-display display-1 font-semibold text-balance">
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
              className="font-display lead-copy mx-auto mt-4 max-w-[52ch] text-muted-foreground sm:mt-5"
            >
              {PROFILE.name} reports on <LeadMark>campus systems</LeadMark>,{" "}
              <LeadMark>Kenyan culture</LeadMark> and <LeadMark>student life</LeadMark> — published
              as video, and readable or listenable here.
            </p>

            <div className="relative mt-7 flex w-full flex-wrap items-center justify-center gap-3 sm:mt-8">
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
                  className="group"
                >
                  <Youtube className="icon-tilt h-4 w-4" aria-hidden />
                  Subscribe
                </Button>
              </div>

              <HeroNote direction="down-left" className="absolute -right-2 -top-4 xl:right-8">
                Nothing loads from YouTube until you press play
              </HeroNote>
            </div>

            {/* The beats, on hairlines — real links, not decoration. */}
            <div data-seq="decor" className="rail mt-8 w-full sm:mt-10">
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
          <div data-seq="image" className="container-site mt-8 grid grid-cols-3 gap-3 sm:mt-10 sm:gap-5">
            {videos.slice(0, 3).map((video, i) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                aria-label={video.title}
                className={cn(
                  "group focus-ring relative block overflow-hidden rounded-xl bg-brand-ink-deep",
                  "shadow-floating ring-1 ring-white/50",
                  // 16:9, the shape the posters actually are. These were 3:4
                  // and 4:5 boxes holding 16:9 thumbnails, which threw away
                  // nearly half the width of every frame — the title cards on
                  // several of these reports were cropped clean off.
                  // The height cap is what lets the whole hero hold to one
                  // screen: on a wide monitor three 16:9 plates across the
                  // container are otherwise taller than the space left.
                  "aspect-video max-h-[19vh]",
                  // The middle card stands proud, so the row has a centre.
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
      {/* The bento is a six-column field with three bands, and the spans are
          chosen by weight rather than to look busy:

            band 1   portrait (2, held across both bands) · biography (4)
            band 2   the three facts (4, as their own row inside that cell)
            band 3   the three reach figures (6)
            band 4   the rest of the set (2 · 2 · 2)

          Under `lg` every cell falls back to full width and the bento becomes
          an ordinary column, which is the honest layout on a phone. */}
      <section className="container-site mt-20 sm:mt-24">
        <div className="stack-mobile grid gap-4 lg:grid-cols-6 lg:gap-5">
          {/* A · Portrait, held down the left across two bands. */}
          <Reveal
            variant="fade-up"
            className="relative overflow-hidden rounded-2xl shadow-primary lg:col-span-2 lg:row-span-2"
          >
            <ImageReveal
              src={PORTRAIT.src}
              alt={PORTRAIT.alt}
              ratio="3/4"
              priority
              className="h-full min-h-[320px] rounded-2xl lg:absolute lg:inset-0"
              imgClassName="object-cover object-top"
            />
            {/* The accounts sit on the portrait, on a scrim that only exists
                where the text does — a full-card overlay would flatten the
                photograph to make room for two links. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-brand-ink-deep/90 via-brand-ink-deep/55 to-transparent p-4 pt-16">
              <div className="pointer-events-auto flex flex-wrap gap-2">
                {SOCIAL_ACCOUNTS.map((account) => (
                  <a
                    key={account.label}
                    href={account.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={account.note}
                    className="focus-ring tap group inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors duration-normal hover:border-white/60 hover:bg-white/20"
                  >
                    <SocialIcon id={account.id} className="icon-tilt h-3.5 w-3.5" />
                    {account.label}
                  </a>
                ))}
              </div>
            </div>
          </Reveal>

          {/* B · Who he is. */}
          <Reveal
            variant="fade-up"
            delay={60}
            className="surface honeycomb honeycomb-strong overflow-hidden p-6 sm:p-8 lg:col-span-4"
          >
            <p className="rule-label">The journalist</p>
            <h2 className="font-display display-2 mt-3 font-semibold text-balance">
              {PROFILE.name}
            </h2>
            <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
              A {PROFILE.role.toLowerCase()} based in {PROFILE.base} and a {PROFILE.education}{" "}
              graduate. The reporting starts with what an institution actually does, then asks the
              people it affects — and it is published as video, first, on {CHANNEL.handle}.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button as={Link} href="/about" variant="outline">
                More about {PROFILE.name.split(" ")[0]}
                <ArrowUpRight className="nudge-x h-4 w-4" aria-hidden />
              </Button>
              <Button as={Link} href="/contact" variant="ghost">
                Send a tip
              </Button>
            </div>
          </Reveal>

          {/* C · The facts, as a list of facts. Nothing here is inferred. */}
          <Stagger className="grid gap-4 sm:grid-cols-3 lg:col-span-4 lg:gap-5" step="tight">
            {[
              { icon: MapPin, label: "Based in", value: PROFILE.base },
              { icon: GraduationCap, label: "Studied at", value: PROFILE.education },
              { icon: Youtube, label: "Publishes on", value: CHANNEL.handle },
            ].map((fact, i) => (
              <StaggerItem key={fact.label} index={i}>
                <Reveal variant="fade-up" distance="sm" className="surface group h-full p-5">
                  <fact.icon className="icon-lean h-4 w-4 text-accent" aria-hidden />
                  <p className="rule-label mt-3">{fact.label}</p>
                  <p className="font-display mt-1 text-[15px] font-semibold leading-snug">
                    {fact.value}
                  </p>
                </Reveal>
              </StaggerItem>
            ))}
          </Stagger>

          {/* D · Reach, from the channel's own recorded figures. */}
          {[
            { value: CHANNEL.videoCount, label: "Reports" },
            { value: totalViews(), label: "Total views" },
            { value: CHANNEL.subscribers, label: "Subscribers" },
          ].map((stat, i) => (
            <Reveal
              key={stat.label}
              variant="fade-up"
              delay={i * 70}
              className="surface honeycomb honeycomb-strong overflow-hidden p-5 sm:p-6 lg:col-span-2"
            >
              <p className="font-display text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                <SpringCountUp to={stat.value} />
              </p>
              <p className="rule-label mt-1.5">{stat.label}</p>
            </Reveal>
          ))}

          {/* E · The rest of the set. Three equal cells so the band reads as a
              contact sheet rather than three more feature cards. */}
          {[WITH_CAMERA, SHOOTING, AGAINST_WALL].map((portrait, i) => (
            <Reveal
              key={portrait.src}
              variant="fade-up"
              delay={i * 70}
              className="group relative overflow-hidden rounded-xl shadow-primary lg:col-span-2"
            >
              <ImageReveal
                src={portrait.src}
                alt={portrait.alt}
                ratio="4/3"
                hoverZoom
                className="rounded-xl"
                imgClassName="object-cover object-top"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink-deep/90 via-brand-ink-deep/30 to-transparent p-4 pt-10 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
              >
                {portrait.caption}
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Wordmark band ────────────────────────────────────────
          The hinge straight out of the biography: having just read who he is,
          the reader gets his name and the line he works under, at scale. Full
          bleed and dark, so it also breaks the page's near-white ground into
          two halves — the person above, the work below. Drag it and it
          scrubs. */}
      <section className="relative mt-20 overflow-hidden border-y border-brand-ink-deep bg-brand-ink-deep py-4 text-white sm:mt-24 sm:py-6">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-ink-deep via-primary/70 to-brand-ink-deep"
        />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />
        <div className="relative">
          <CurvedMarquee
            text="Victor Kiplimo || Imago dei Lator · "
            speed={1.1}
            curveAmount={70}
            className="text-white/90"
          />
        </div>
      </section>

      {/* ── Beats ────────────────────────────────────────────────── */}
      {/* The tiles used to sit on alternating vertical offsets, which pushed
          the lower row past the section's box and left cards half-hidden
          under the next section. The bento spans below give the same broken
          rhythm without any of them leaving the flow. */}
      <section className="container-site mt-28">
        <SectionHeading
          label="Beats"
          title="What I cover"
          action={{ href: "/genres", label: "Every beat" }}
        />
        {/* A 6-column bento that alternates 4·2 / 2·4, so the four beats read
            as a woven pair of rows rather than four identical columns — and
            each wide cell has room for its description to breathe while the
            narrow ones stay terse. The count is real: it is how many reports
            are filed under that beat. */}
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5" step="tight">
          {TOPICS.map((topic, i) => {
            const wide = i === 0 || i === 3;
            const count = videosByTopic(topic.slug).length;

            return (
              <StaggerItem
                key={topic.slug}
                index={i}
                className={wide ? "lg:col-span-4" : "lg:col-span-2"}
              >
                <Reveal variant="fade-up" distance="sm" className="h-full">
                  <Link
                    href={`/videos?topic=${topic.slug}`}
                    className="surface surface-hover group focus-ring relative flex h-full flex-col overflow-hidden p-6 sm:p-7"
                  >
                    <span
                      aria-hidden
                      className="absolute -right-6 -top-6 h-20 w-16 bg-accent/8 transition-colors duration-slow group-hover:bg-accent/16"
                      style={{
                        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      }}
                    />
                    <div className="relative flex items-start justify-between gap-4">
                      <p
                        className={cn(
                          "font-display font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none",
                          wide ? "text-2xl sm:text-3xl" : "text-xl",
                        )}
                      >
                        {topic.name}
                      </p>
                      <span className="font-display shrink-0 text-sm font-semibold tabular-nums text-primary">
                        {count}
                        <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {count === 1 ? "report" : "reports"}
                        </span>
                      </span>
                    </div>
                    <p
                      className={cn(
                        "relative mt-3 flex-1 leading-relaxed text-muted-foreground",
                        wide ? "max-w-[46ch] text-[0.95rem]" : "text-sm",
                      )}
                    >
                      {topic.description}
                    </p>
                    <ArrowUpRight
                      className="nudge-x relative mt-5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
                      aria-hidden
                    />
                  </Link>
                </Reveal>
              </StaggerItem>
            );
          })}
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

        {/* Twelve columns, so the rhythm can be 7·5 then 4·4·4 rather than a
            wall of identical thirds. A uniform grid says every report matters
            the same amount, which is the one thing an editorial page should
            never say — and at twelve the pattern repeats every five cards, so
            it stays composed however many there are. */}
        {/* Stacked on a phone — six reports as a tall column is a lot of thumb,
            and stacked they arrive one at a time. The bento is untouched from
            `lg` up; see `.stack-mobile`. */}
        <Stagger
          className="stack-mobile mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5"
          step="normal"
        >
          {rest.map((video, i) => (
            <StaggerItem key={video.id} index={i} className={reportSpan(i)}>
              <VideoCard video={video} />
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
            action={{ href: "/stories", label: "All writing" }}
          />
          {/* The newest piece leads at four columns; everything after it takes
              two. The narration tile closes the row — it is the section's
              actual promise, and as a cell it fills the bento at any count
              instead of leaving a hole when there is only one piece. */}
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
            {written.map((story, i) => (
              <StaggerItem
                key={story.id}
                index={i}
                className={cn("sm:col-span-2", i === 0 ? "lg:col-span-4" : "lg:col-span-2")}
              >
                <StoryCard story={story} variant={i === 0 ? "feature" : "default"} />
              </StaggerItem>
            ))}

            <StaggerItem index={written.length} className="sm:col-span-2 lg:col-span-2">
              <Reveal
                variant="fade-up"
                className="surface honeycomb honeycomb-strong group flex h-full flex-col overflow-hidden p-6 sm:p-7"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-raised">
                  <Headphones className="icon-rise h-4 w-4" aria-hidden />
                </span>
                <p className="font-display mt-5 text-xl font-semibold tracking-tight">
                  Every piece plays aloud
                </p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  Written work can be read on the page or narrated, with the paragraph being spoken
                  highlighted as it goes. Nothing starts playing on its own.
                </p>
                <Button as={Link} href="/stories" variant="outline" size="sm" className="mt-6 self-start">
                  All writing
                  <ArrowUpRight className="nudge-x h-4 w-4" aria-hidden />
                </Button>
              </Reveal>
            </StaggerItem>
          </Stagger>
        </section>
      )}

      {/* ── Channel ──────────────────────────────────────────────── */}
      <section className="container-site mt-28">
        <Reveal variant="fade-up" className="border-t border-border pt-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="rule-label">The channel</p>
              <h2 className="font-display display-2 mt-3 font-semibold text-balance">
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
                className="group mt-7"
              >
                <Youtube className="icon-tilt h-4 w-4" aria-hidden />
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
