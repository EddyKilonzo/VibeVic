"use client";

import Link from "next/link";
import { ArrowUpRight, GraduationCap, MapPin } from "lucide-react";
import { PROFILE, SOCIAL_ACCOUNTS } from "@/data/content";
import {
  AGAINST_WALL,
  FIELD_CLIP,
  ON_ASSIGNMENT,
  PORTRAIT,
  REVIEWING_FRAMES,
  WALL,
} from "@/data/portraits";
import { SocialIcon } from "@/components/social/SocialIcon";
import { FieldClip } from "@/components/media/FieldClip";
import {
  PictureWall,
  PressPass,
  ScrollStack,
  ScrollStackItem,
  TiltedFrame,
} from "@/components/reactbits";
import { CHANNEL, TOPICS, totalViews } from "@/data/videos";
import {
  CountUp,
  ImageReveal,
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
} from "@/components/motion";
import { Button } from "@/components/ui/Button";

/**
 * Biography.
 *
 * Everything stated here is either verified from the channel or was supplied
 * by Victor directly — the name, the beat, the university, the figures. The
 * page is deliberately short: it is better to say four true things than to
 * pad it with a career narrative nobody confirmed.
 */
export default function About() {
  const stats = [
    { value: CHANNEL.videoCount, label: "Reports published" },
    { value: totalViews(), label: "Total views" },
    { value: CHANNEL.subscribers, label: "Subscribers" },
    { value: TOPICS.length, label: "Beats covered" },
  ];

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────
          The portrait is beside the title, not behind it, and at its own 3:4.
          Full bleed it was a 1080×1440 picture cropped into a band four
          hundred pixels tall — a horizontal sliver of a coat, with the man it
          is a photograph of outside the frame. A hero image that has to be
          cropped past recognition is not doing a hero's job.

          The ground is the comb at its loud weight, matching the article
          hero. Nothing here is body copy, which is the condition for using
          it. */}
      <header className="honeycomb honeycomb-intense honeycomb-fade relative isolate overflow-hidden border-b border-border pb-12 pt-28 sm:pb-16 sm:pt-36">
        <div className="container-site relative">
          <div className="grid items-center gap-10 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)] sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-16">
            <div>
              <p className="rule-label">About</p>
              <TextReveal
                as="h1"
                lines={["Victor Kiplimo,", "journalist."]}
                className="font-display mt-4 text-[2.4rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]"
                immediate
              />
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
                Reporting from {PROFILE.base} — campus systems, Kenyan culture and student life.
              </p>
            </div>

            {/* A press pass on a lanyard, with rope physics — drag it and it
                swings. It is the one object on this site that *is* the
                subject rather than a decoration of it, which is the only
                reason a WebGL scene is allowed anywhere near a reading site.
                On touch, and under reduced motion, the photograph it would
                have replaced is shown instead. */}
            <PressPass
              frontImage={PORTRAIT.src}
              className="min-h-[480px] lg:min-h-[620px]"
              fallback={
                <Reveal variant="fade-scale" delay={140}>
                  <ImageReveal
                    src={AGAINST_WALL.src}
                    alt={AGAINST_WALL.alt}
                    ratio="3/4"
                    priority
                    immediate
                    className="mx-auto max-w-[260px] rounded-2xl shadow-primary sm:max-w-none"
                    imgClassName="object-cover object-top"
                  />
                </Reveal>
              }
            />
          </div>
        </div>
      </header>

      <div className="container-site pt-16 sm:pt-20">
        {/* Text and image enter from opposite sides — the one place on the
            site where a directional reveal carries meaning. */}
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <Reveal variant="fade-right">
            <div className="space-y-6 text-[1.05rem] leading-[1.8] text-foreground/90">
              <p>
                I'm a journalist based in {PROFILE.base}, and a graduate of{" "}
                <span className="font-semibold text-primary">{PROFILE.education}</span>. I report,
                shoot and edit my own pieces, and publish them on{" "}
                <a
                  href={CHANNEL.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-grow font-medium text-primary"
                >
                  {CHANNEL.handle}
                </a>
                .
              </p>
              <p>
                The work so far has centred on the Eldoret National Polytechnic — how the
                institution runs, what changes when a process like procurement moves online, and
                what students carry that never appears in an official statement. Alongside that
                sit cultural pieces and commissioned features.
              </p>
              <p>
                Everything is short-form on purpose. A two-minute report that someone finishes is
                worth more than a ten-minute one they close halfway through.
              </p>
            </div>

            <ul className="mt-9 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <GraduationCap className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{PROFILE.education}</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{PROFILE.base}</span>
              </li>
              {SOCIAL_ACCOUNTS.map((account) => (
                <li key={account.id} className="group flex items-center gap-3">
                  <SocialIcon id={account.id} className="icon-tilt h-4 w-4 shrink-0 text-accent" />
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-grow"
                  >
                    {account.handle}
                  </a>
                  <span className="text-muted-foreground">· {account.label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button as={Link} href="/videos">
                Watch the work
              </Button>
              <Button as={Link} href="/contact" variant="outline">
                Get in touch
              </Button>
            </div>
          </Reveal>

          {/* No photograph in this column any more. There are four pictures in
              the set and this page has a hero and a gallery of three, which is
              five slots — and a portrait appearing twice on one page reads as
              a shortage rather than a choice. The hero carries the face; this
              column carries the record. */}
          <Reveal variant="fade-left">
            <div className="surface honeycomb honeycomb-strong overflow-hidden p-6 sm:p-8 lg:sticky lg:top-28">
              <p className="rule-label">The record</p>
              <Stagger className="mt-6 grid gap-4 sm:grid-cols-2" step="tight">
                {stats.map((stat, i) => (
                  <StaggerItem key={stat.label} index={i}>
                    <Reveal variant="fade-up" distance="sm">
                      <p className="font-display text-3xl font-semibold tracking-tight text-primary">
                        <CountUp value={stat.value} />
                      </p>
                      <p className="rule-label mt-1.5">{stat.label}</p>
                    </Reveal>
                  </StaggerItem>
                ))}
              </Stagger>

              <p className="mt-7 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                Figures are read from the channel itself, not estimated. They are a snapshot from
                when this page was built.
              </p>
            </div>
          </Reveal>
        </div>

        {/* ── Portraits ──────────────────────────────────────────
            Three frames across the full width. Splitting into thirds is what
            keeps each one a plate rather than a poster — the same set at two
            across was half a screen of coat per picture. The middle one drops
            half a step from `lg` up so the row interlocks rather than sitting
            on one flat baseline; on a phone it is a plain column, which is the
            right answer there. */}
        <section className="mt-24 sm:mt-28">
          <p className="rule-label">Portraits</p>
          {/* A picture wall rather than a row of equal plates. The heights are
              each frame's own proportion scaled to a common column width, so
              the wall is ragged because the pictures are, and nothing is
              cropped to make a tidy grid. */}
          <PictureWall
            className="mt-8"
            items={WALL.map((portrait) => ({
              id: portrait.src,
              img: portrait.src,
              alt: portrait.alt,
              caption: portrait.caption,
              width: portrait.width,
              height: portrait.height,
            }))}
          />
        </section>

        {/* ── In the field ───────────────────────────────────────
            The portraits above are him posed; these are him working, in
            colour, and the clip is his own footage. A bento rather than a
            third row of equal plates: the vertical clip holds the left of the
            band at its native 9:16 and the two stills stack beside it, which
            is the only arrangement that lets a portrait video and two portrait
            photographs share a row without one of them being cropped to suit
            the others. */}
        <section className="mt-24 sm:mt-28">
          <p className="rule-label">In the field</p>
          <h2 className="font-display display-3 mt-3 font-semibold text-balance">
            {FIELD_CLIP.title}
          </h2>
          <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
            {FIELD_CLIP.caption}
          </p>

          <div className="stack-mobile mt-8 grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <FieldClip src={FIELD_CLIP.src} title={FIELD_CLIP.title} />

            {/* Tilted frames here rather than plain plates: these two need a
                few words to mean anything, and a caption sitting under a
                picture is read as an afterthought. Over it, it is the label. */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {[ON_ASSIGNMENT, REVIEWING_FRAMES].map((shot, i) => (
                <Reveal key={shot.src} variant="fade-up" delay={i * 80}>
                  <TiltedFrame
                    src={shot.src}
                    alt={shot.alt}
                    caption={shot.caption}
                    height="clamp(320px, 46vw, 560px)"
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Follow ─────────────────────────────────────────────
            The end of a biography is where a reader decides whether to keep
            up with someone, so the accounts sit here rather than only in the
            footer — one card each, saying what is on it, because three logos
            in a row do not tell anybody which one they want. */}
        <section className="mt-24 lg:mt-32">
          <p className="rule-label">Follow the work</p>
          <h2 className="font-display display-3 mt-3 font-semibold text-balance">
            Three places, three different things.
          </h2>

          {/* Three cards that park and stack as the next arrives. A short,
              ordered, finite set is the one shape this reads well at, and
              three destinations at the end of a biography is exactly that. */}
          <ScrollStack className="mt-8">
            {SOCIAL_ACCOUNTS.map((account) => (
              <ScrollStackItem
                key={account.id}
                className="surface honeycomb honeycomb-strong overflow-hidden"
              >
                <a
                  href={account.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring group flex h-full flex-col p-6 sm:p-7"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground shadow-raised">
                    <SocialIcon id={account.id} className="icon-tilt h-5 w-5" />
                  </span>
                  <p className="font-display mt-5 text-xl font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
                    {account.label}
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {account.note}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {account.handle}
                    <ArrowUpRight
                      className="nudge-x h-4 w-4 transition-colors group-hover:text-accent"
                      aria-hidden
                    />
                  </span>
                </a>
              </ScrollStackItem>
            ))}
          </ScrollStack>
        </section>
      </div>
    </div>
  );
}
