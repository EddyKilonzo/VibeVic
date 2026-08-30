"use client";

import Link from "next/link";
import { ArrowUpRight, GraduationCap, MapPin } from "lucide-react";
import { ABOUT_INTRO, PROFILE, QUOTE_OF_THE_WEEK, SOCIAL_ACCOUNTS } from "@/data/content";
import type { Publication } from "@/data/types";
import {
  AGAINST_WALL,
  FIELD_CLIP,
  ON_ASSIGNMENT,
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
  Typewriter,
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
export default function About({
  publications,
}: {
  /**
   * Where the work has run, from the database.
   *
   * The `publications` table has been seeded and served since the API landed
   * and nothing rendered it — a masthead the journalist had recorded that no
   * reader could see. This is where it belongs: the biography is the page
   * somebody reads to find out where else to find him.
   */
  publications: Publication[];
}) {
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
      <header className="honeycomb honeycomb-intense honeycomb-fade relative isolate flex min-h-[80svh] flex-col justify-center overflow-clip border-b border-border pb-12 pt-28 sm:pb-16 sm:pt-36">
        <div className="container-site relative">
          {/* Tighter than it was. The pass and the name belong to each other —
              at a sixteen-unit gap they read as two separate things that
              happen to share a row, and the card drifted off toward the
              gutter. The image column is also wider now, so the card is close
              enough to the words to be part of the same object. */}
          <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-8">
            <div>
              <p className="rule-label">About</p>
              <TextReveal
                as="h1"
                lines={["Victor Kiplimo,", "journalist."]}
                className="font-display mt-4 text-[2.4rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]"
                immediate
              />
              <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted-foreground">
                Reporting from {PROFILE.base} — campus systems, Kenyan culture and student life.
                He films, writes and edits every piece himself, and publishes it on{" "}
                {CHANNEL.handle} first.
              </p>

              {/* A hero of one line and a title reads as a placeholder. These
                  three facts are the ones a reader wants before deciding
                  whether to keep going, and every one of them is already
                  stated further down the page — nothing new is claimed here. */}
              <dl className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {[
                  { term: "Based in", value: PROFILE.base },
                  { term: "Studying at", value: PROFILE.education },
                  { term: "Beats", value: `${TOPICS.length} subjects` },
                ].map((fact) => (
                  <div key={fact.term}>
                    <dt className="rule-label">{fact.term}</dt>
                    <dd className="font-display mt-1.5 text-[15px] font-semibold leading-snug">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button as={Link} href="/videos">
                  Watch the work
                </Button>
                <Button as={Link} href="/stories" variant="outline">
                  Read the writing
                </Button>
              </div>
            </div>

            {/* A press pass on a lanyard, with rope physics — drag it and it
                swings. It is the one object on this site that *is* the
                subject rather than a decoration of it, which is the only
                reason a WebGL scene is allowed anywhere near a reading site.
                On touch, and under reduced motion, the photograph it would
                have replaced is shown instead. */}
            <PressPass
              // The card face is a composed pass, not a bare photograph:
              // PRESS across the top, his name and role across the foot. The
              // strap alone was carrying that job and a strap is 40px wide on
              // screen — the words belong on the thing you actually look at.
              frontImage="/lanyard/press-card.png"
              // Sized against the viewport, not a fixed pixel height. The pass
              // hangs from the top of its box, so a box taller than the space
              // available pushed the card itself below the fold — the one part
              // of it worth seeing. Capped so it cannot outgrow the 80svh hero
              // it sits in.
              className="h-[min(62svh,540px)] min-h-[400px]"
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
            {/* ── His words, and only his words ─────────────────────
                This block used to carry three paragraphs I had written in his
                voice — about reporting on his own college, about short-form
                being deliberate. They read well and he never said them. On a
                journalist's own About page, invented first-person copy is a
                fabricated quotation with extra steps, so it is gone.

                What is left is his introduction from Vic Unfiltered, verbatim,
                plus one line of plain third-person fact that makes no claim
                about how he thinks. */}
            <div className="space-y-6 text-[1.05rem] leading-[1.8] text-foreground/90">
              <p className="font-display text-[1.35rem] font-semibold leading-[1.45] text-foreground">
                {ABOUT_INTRO.greeting}
              </p>
              {ABOUT_INTRO.lines.map((line) => (
                <p key={line} className="max-w-[46ch]">
                  {line}
                </p>
              ))}
              <p className="border-t border-border pt-6 text-[0.95rem] text-muted-foreground">
                Victor is a {PROFILE.educationStatus} at{" "}
                <span className="font-semibold text-primary">{PROFILE.education}</span>, based in{" "}
                {PROFILE.base}. He films and edits his own reports and publishes them on{" "}
                <a
                  href={CHANNEL.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-grow font-medium text-primary"
                >
                  {CHANNEL.handle}
                </a>
                , and writes at{" "}
                <a
                  href="https://vicunfiltered.wordpress.com"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-grow font-medium text-primary"
                >
                  Vic Unfiltered
                </a>
                .
              </p>
            </div>

            {/* A grid, not a column. Eight single-line entries stacked made a
                narrow ladder down the left of a wide page, and at small widths
                the platform name wrapped onto its own line after each handle.
                In two columns every entry is a self-contained cell, the icons
                form a readable rail, and the block finishes near where the
                paragraph beside it does. */}
            <ul className="mt-9 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-3">
                <GraduationCap className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">{PROFILE.education}</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">{PROFILE.base}</span>
              </li>
              {SOCIAL_ACCOUNTS.map((account) => (
                <li key={account.id} className="group flex items-center gap-3">
                  <SocialIcon id={account.id} className="icon-tilt h-4 w-4 shrink-0 text-accent" />
                  <span className="min-w-0">
                    <a
                      href={account.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline-grow block truncate font-medium"
                    >
                      {account.handle}
                    </a>
                    <span className="block text-xs text-muted-foreground">{account.label}</span>
                  </span>
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
        {/* ── Portraits ──────────────────────────────────────────
            A titled band on its own ground rather than four pictures after a
            label. The heading sits in a left column and the wall runs beside
            it from `lg` up, which is what stops a gallery reading as an
            afterthought stapled to the end of the biography — and on the way
            it gives the pictures a narrower measure, so they are plates
            instead of posters.

            The wall is CSS columns: each tile keeps its own proportion, so
            the ragged edge is the set's, not a crop. */}
        {/* `overflow-clip`, not `overflow-hidden`, and the difference is the
            whole reason the heading below sticks. `hidden` makes an element a
            scroll container: `position: sticky` then anchors to *it* rather
            than to the page, and since that box never scrolls, the heading
            never moves. `clip` clips the honeycomb to the rounded corners in
            exactly the same way without creating a scroller, so the sticky
            column keeps measuring against the viewport. */}
        <section className="honeycomb honeycomb-strong relative mt-24 overflow-clip rounded-2xl border border-border p-6 sm:mt-28 sm:p-10 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="rule-label">Portraits</p>
              <h2 className="font-display display-3 mt-3 font-semibold text-balance">
                The set, in black and white.
              </h2>
              <p className="mt-4 max-w-[36ch] leading-relaxed text-muted-foreground">
                Shot in one session. They are portraits, not reporting — which
                is why none of them is used as a cover on a story.
              </p>
            </div>

            <PictureWall
              // One column on a phone — two portraits side by side inside an
              // already-narrow band are thumbnails, and the whole point of the
              // wall is that you can see the photographs.
              className="columns-1 sm:columns-2 lg:columns-2"
              items={WALL.map((portrait) => ({
                id: portrait.src,
                img: portrait.src,
                alt: portrait.alt,
                caption: portrait.caption,
                width: portrait.width,
                height: portrait.height,
              }))}
            />
          </div>
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

          {/* Also not stacked: a 9:16 video beside two 4:5 stills is three
              different shapes, and the clip parked over the photographs. */}
          <div className="mt-8 grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
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

        {/* ── Where it runs ──────────────────────────────────────
            Read from the database rather than written here, so adding a
            masthead is a row and not a deploy. Rendered as a definition-style
            list: each entry is a place, a role and a period, and the period is
            the part a reader scans for — it is what says whether this is
            current work or a line on a CV. */}
        {publications.length > 0 && (
          <section className="mt-24 sm:mt-28">
            <p className="rule-label">Where the work runs</p>
            <h2 className="font-display display-3 mt-3 font-semibold text-balance">
              The mastheads, and what he does at each.
            </h2>

            <Stagger className="mt-8 grid gap-4 sm:gap-5" step="tight">
              {publications.map((publication, i) => (
                <StaggerItem key={`${publication.name}-${publication.period}`} index={i}>
                  <Reveal variant="fade-up" distance="sm">
                    <div className="surface p-6 sm:p-7">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                        <h3 className="font-display text-xl font-semibold tracking-tight">
                          {/* Linked only where there is somewhere to go. An
                              entry with no URL is still a real credit; giving
                              it a dead link would be worse than plain text. */}
                          {publication.url ? (
                            <a
                              href={publication.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="focus-ring underline-grow"
                            >
                              {publication.name}
                            </a>
                          ) : (
                            publication.name
                          )}
                        </h3>
                        <p className="rule-label shrink-0">{publication.period}</p>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-accent">{publication.role}</p>
                      <p className="mt-3 max-w-[62ch] leading-relaxed text-muted-foreground">
                        {publication.description}
                      </p>
                    </div>
                  </Reveal>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {/* ── Quote ──────────────────────────────────────────────
            The line he runs on his own site, carried across with its
            attribution attached. It is set as a quotation and credited in the
            markup as well as visually — on a journalist's page an
            unattributed line in large italics reads as something he said. */}
        <Reveal
          variant="fade-up"
          className="honeycomb honeycomb-strong mt-24 overflow-clip rounded-2xl border border-border p-8 sm:p-12 lg:mt-28"
        >
          <p className="rule-label">Quote of the week</p>
          <figure className="mt-5">
            <blockquote cite={QUOTE_OF_THE_WEEK.cite}>
              {/* Typed out on arrival, and again each time it is scrolled back
                  into view. The quotation is short and sits alone in its band,
                  which is the only place on a reading site where watching text
                  appear is worth the reader's attention rather than a delay
                  between them and the words. */}
              <Typewriter
                text={`“${QUOTE_OF_THE_WEEK.text}”`}
                className="font-display max-w-[34ch] text-balance text-2xl font-semibold leading-[1.35] text-primary sm:text-[2rem]"
              />
            </blockquote>
            <figcaption className="mt-5 text-sm text-muted-foreground">
              — <cite className="not-italic font-semibold">{QUOTE_OF_THE_WEEK.author}</cite>
            </figcaption>
          </figure>
        </Reveal>

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
                {/* Laid out across the card rather than stacked down the left
                    of it: the mark and the platform name make a header row,
                    the sentence takes the middle, and the handle sits on a
                    hairline floor with the arrow pushed to the far edge. The
                    stacked version left a column of dead space on the right of
                    every card and a ragged bottom edge across the three. */}
                <a
                  href={account.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring group flex h-full flex-col p-6 sm:p-8"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-raised">
                      <SocialIcon id={account.id} className="icon-tilt h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-xl font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
                        {account.label}
                      </p>
                      <p className="rule-label mt-1">{account.handle}</p>
                    </div>
                  </div>

                  <p className="mt-5 flex-1 text-[0.95rem] leading-relaxed text-muted-foreground">
                    {account.note}
                  </p>

                  <span className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm font-semibold text-primary">
                    Follow on {account.label}
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
