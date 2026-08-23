"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { Story as StoryRecord } from "@/data/types";
import { PROFILE, genreLabel, relatedStories } from "@/data/content";
import { PORTRAIT } from "@/data/portraits";
import { PortraitFrame } from "@/components/media/PortraitFrame";
import { storyCover } from "@/lib/cover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useReadingPosition } from "@/hooks/useReadingPosition";
import { useFollowAlong } from "@/hooks/useFollowAlong";
import { useVoice } from "@/context/VoiceProvider";
import { ImageReveal, Reveal, ScrollProgress, Stagger, StaggerItem } from "@/components/motion";
import { Inline } from "@/components/story/Inline";
import { ArticleActionBar } from "@/components/story/ArticleActionBar";
import { ArticleBody } from "@/components/story/ArticleBody";
import { ArticleSections } from "@/components/story/ArticleSections";
import { SectionSheet } from "@/components/story/SectionSheet";
import { ReadingHUD } from "@/components/story/ReadingHUD";
import { ResumeReading } from "@/components/story/ResumeReading";
import { QuoteSelection } from "@/components/story/QuoteSelection";
import { ReadingControls, useReadingScale } from "@/components/story/ReadingControls";
import { StoryCard } from "@/components/story/StoryCard";
import { SectionHeading } from "@/components/SectionHeading";

/**
 * The article.
 *
 * ── Why the story arrives as a prop ──────────────────────────────────────
 * It used to fetch itself: `useAsync(() => api.story(slug))`, a client-side
 * call that resolves after hydration. The consequence was invisible in a
 * browser and fatal for search — the server response contained a skeleton and
 * nothing else. No `<h1>`, no `<article>`, not one sentence of the piece. A
 * crawler fetching an article got 34KB of layout and no article, and had to
 * execute JavaScript to find out there was anything there at all.
 *
 * The route already knows the story: it is static data, resolved at build
 * time, and it is what `generateMetadata` reads. Passing it down means this
 * component renders the full piece in the server response, and hydration
 * takes over an article that is already on the page rather than building one.
 *
 * The component stays a client component because everything *around* the
 * prose is interactive — narration, the reading HUD, the section spy, the
 * quote tool. Those hydrate as before; the words no longer wait for them.
 */
export default function Story({ slug, story }: { slug: string; story: StoryRecord }) {
  const articleRef = useRef<HTMLElement>(null);
  /**
   * The prose, and only the prose.
   *
   * Reading progress used to be measured against `<article>`, which contains
   * the hero — so the ring showed a reader several per cent through a piece
   * they had not started a sentence of. Now that "Related work" shares the
   * column too, measuring the wrapper would count the next three headlines as
   * part of this one. Everything that reports *where the reader is* reads this
   * instead: the sheet the words are set on.
   */
  const proseRef = useRef<HTMLDivElement>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const scale = useReadingScale();
  const reduced = useReducedMotion();

  // Every following-along feature on this page reads from the same two facts:
  // which heading the reader is under, and how far through they are. Both are
  // derived once here and handed down, so the rail, the sheet and the HUD can
  // never disagree about where the reader is.
  const headings = (story?.body ?? []).filter(
    (block): block is Extract<typeof block, { type: "heading" }> => block.type === "heading",
  );
  const activeSection = useActiveSection(headings.map((heading) => heading.id));
  const { saved, record, decline } = useReadingPosition(slug);

  const { load, stop, state, activeBlockId, preferences } = useVoice();
  const listening = state === "playing" || state === "paused";

  // Hand the article to the voice engine as soon as it arrives — preparing the
  // text costs nothing and means the first press of Listen starts speaking
  // rather than parsing. Nothing plays until the reader asks.
  useEffect(() => {
    if (story) load(story.slug, story.title, story.body);
  }, [story, load]);

  // Leaving the piece stops the narration. A voice that follows you onto the
  // next page is a bug, not a feature.
  useEffect(() => () => stop(), [slug, stop]);

  useFollowAlong(activeBlockId, preferences.followAlong && listening);

  // No loading branch and no error branch any more. The story is resolved
  // before this renders, and a slug that matches nothing is a 404 from the
  // route rather than a 200 carrying an apology — which is what a crawler
  // needs, and what a reader deserves too.
  const related = relatedStories(story);

  return (
    <>
      {/* Progress through the prose, not the document and not the hero —
          neither the cover nor the related cards are reading. */}
      <ScrollProgress target={proseRef} />
      <SectionSheet
        story={story}
        activeIndex={activeSection}
        open={sectionsOpen}
        onClose={() => setSectionsOpen(false)}
      />
      <QuoteSelection story={story} target={proseRef} />

      {/* The bottom readout. Suppressed on a phone while the voice transport
          is up — they want the same corner, and the transport is the one the
          reader explicitly asked for. */}
      <ReadingHUD
        target={proseRef}
        story={story}
        sectionLabel={headings[activeSection]?.text ?? null}
        onOpenSections={headings.length >= 2 ? () => setSectionsOpen(true) : undefined}
        onProgress={record}
        className={listening ? "max-lg:hidden" : undefined}
      />

      <article ref={articleRef} className={cn(listening && "pb-24 lg:pb-0")}>
        {/* ── Hero ─────────────────────────────────────────────────
            The cover is the top of the page rather than a plate dropped in
            after the headline. It was doing nothing where it was: a reader had
            already read the title, the standfirst and the byline before
            reaching it, so it arrived as an interruption between the header
            and the prose. Set behind the words it does the job a cover is for
            — it establishes the piece before a single line is read.

            The masthead is transparent over this, which is why the top
            padding clears it and the scrim is heaviest at the top. */}
        {/* The ground here is the comb, at the one weight it is allowed to be
            loud — there is no body copy in this band for it to compete with.
            It replaced a dark scrim over the cover art: those covers are
            generated gradients, so a gradient wash over a gradient was two
            gradients arguing, and the title was reading as a caption on a
            picture rather than as the top of a piece.

            The cover survives as a plate beside the headline instead of
            underneath it, which is also the only honest place for it — it is
            generated art, not a photograph of anything, and at full bleed it
            implied it was. */}
        <header className="honeycomb honeycomb-intense honeycomb-fade relative isolate overflow-hidden border-b border-border pb-12 pt-28 sm:pb-16 sm:pt-36">
          <div className="container-site relative">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-16">
              <div>
                <Reveal variant="fade-up" distance="sm">
                  <Link
                    /* The beat's own page, not `/stories?genre=…`. The query
                       view is canonicalised to `/stories`, so linking it from
                       every article pointed the site's densest internal link
                       at a URL that deliberately does not rank. */
                    href={`/beats/${story.genre}`}
                    className="focus-ring kicker underline-grow"
                  >
                    {genreLabel(story.genre)}
                  </Link>
                </Reveal>

                {/* Word by word, each rising out from behind its own mask.
                    A headline is the one place on a reading page where the
                    entrance can be the thing you notice — after this the
                    animation budget goes entirely on not distracting anyone.
                    The words stay ordinary inline text inside the masks, so
                    selection, search and screen readers see one sentence. */}
                <h1 className="font-display mt-3.5 flex flex-wrap gap-x-[0.26em] text-[1.95rem] font-semibold leading-[1.08] tracking-tight sm:text-[2.7rem] lg:text-[3.1rem]">
                  {story.title.split(" ").map((word, i) => (
                    <span key={`${word}-${i}`} className="block overflow-hidden pb-[0.12em]">
                      <motion.span
                        className="block"
                        initial={reduced ? false : { y: "115%" }}
                        animate={{ y: "0%" }}
                        transition={{ ...transitions.editorial, delay: 0.1 + i * 0.045 }}
                      >
                        {word}
                      </motion.span>
                    </span>
                  ))}
                </h1>

                <Reveal variant="fade-up" delay={260}>
                  <p className="mt-5 max-w-[52ch] text-pretty text-lg leading-relaxed text-muted-foreground">
                    {/* Emphasis renders here too. The standfirst is written
                        in the same editor as the body, and markers left
                        showing as literal asterisks under the headline is the
                        most visible place this could leak. */}
                    <Inline text={story.dek} />
                  </p>
                </Reveal>

                <Reveal variant="fade-up" delay={320}>
                  <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                    {/* Byline portrait. Decorative — the name beside it already
                        carries the attribution, so it stays out of the reading
                        order rather than repeating it to a screen reader. */}
                    <PortraitFrame
                      portrait={PORTRAIT}
                      size={40}
                      className="h-10 w-10 shrink-0 rounded-full shadow-raised ring-1 ring-border"
                    />
                    <span className="font-medium text-foreground">{PROFILE.name}</span>
                    <span aria-hidden className="h-3 w-px bg-border" />
                    <time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time>
                    <span aria-hidden className="h-3 w-px bg-border" />
                    <span>{story.readingMinutes} min read</span>
                    {story.publication && (
                      <>
                        <span aria-hidden className="h-3 w-px bg-border" />
                        <span>Originally in {story.publication}</span>
                      </>
                    )}
                  </div>
                </Reveal>
              </div>

              {/* 16:10, because that is the shape `coverFor` generates. Any
                  other ratio here means `object-cover` quietly crops the art
                  the page just asked for — and on a phone the plate was
                  hidden outright, which is not "it does not fit", it is "it
                  is not there". */}
              <Reveal variant="fade-scale" delay={180}>
                <ImageReveal
                  src={storyCover(story)}
                  alt=""
                  ratio="16/10"
                  priority
                  immediate
                  // A fixed 360px column from `lg` up, full width below it.
                  // This is the article's LCP candidate, so the size it asks
                  // for is the size it should get.
                  sizes="(min-width: 1024px) 360px, 100vw"
                  className="rounded-2xl shadow-primary"
                />
              </Reveal>
            </div>
          </div>
        </header>

        {/* ── Body and rail ────────────────────────────────────────
            Everything the reader *operates* moves to the right column and
            stays with them as they scroll: modes, saving, sharing, text size
            and the section index. It used to sit in a stack above the first
            paragraph, which meant the controls were only reachable by
            scrolling back to the top — the moment you actually want to change
            text size or jump a section is half-way down, not before you have
            started.

            Below `lg` the rail becomes a single card above the article, in
            the order it was in before. A 290px column has nowhere to go on a
            phone, and a reader on one gets the same controls in the bottom
            HUD and the section sheet anyway. */}
        <div className="container-site mt-10 sm:mt-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-14">
            <aside className="lg:order-2">
              {/* Everything in the rail lives inside the sticky box.

                  The resume card used to be a sibling below it, which is the
                  one arrangement `position: sticky` gets wrong on purpose: a
                  sticky element stays in flow at its static position and then
                  translates down as you scroll, so it slides straight over
                  whatever follows it. The offer to pick up where you left off
                  was being covered by the controls within a screen of
                  scrolling. */}
              {/* Capped and scrollable from `lg`, where it is pinned. With
                  the resume offer, both control groups and a section index in
                  one card, the rail is taller than a 768px laptop viewport,
                  and a sticky box taller than the screen simply hides its own
                  bottom — the section list, which is the part a reader
                  actually navigates with. `overflow-y` on the sticky element
                  itself is safe; it is an *ancestor* scroll container that
                  breaks sticky. */}
              <div className="surface p-5 sm:p-6 lg:sticky lg:top-28 lg:max-h-[calc(100svh-9rem)] lg:overflow-y-auto">
                {/* Offered, never applied — see `useReadingPosition`. First in
                    the rail because it is the one thing here that expires:
                    everything below it is available for the whole read. */}
                {saved !== null && (
                  <ResumeReading progress={saved} target={proseRef} onDismiss={decline} />
                )}

                <ArticleActionBar story={story} className={saved !== null ? "mt-4" : undefined} />

                <div className="mt-5 border-t border-border pt-5">
                  <ReadingControls
                    story={story}
                    onOpenSections={() => setSectionsOpen(true)}
                    className="lg:hidden"
                  />
                  {/* On the rail the size control does not need the sheet
                      trigger beside it — the sections are listed below. */}
                  <ReadingControls story={story} className="hidden lg:flex" />
                </div>

                <ArticleSections
                  story={story}
                  activeIndex={activeSection}
                  className="mt-6 hidden border-t border-border pt-6 lg:block"
                />
              </div>
            </aside>

            {/* The reading column, and everything that follows the piece.

                "Related work" used to be a full-width section *after* the
                grid, which meant the grid — and therefore the rail's footing
                — ended with the last paragraph. The rail unpinned a whole
                screen before the footer and left the page ending on a bare
                column. Keeping the related cards in this column gives the
                sticky box something to hold onto all the way down. */}
            {/* The bottom padding is the rail's footing.
                A sticky box travels only as far as its containing block, and
                the aside's height is the grid row's height — which is set by
                *this* column. Padding on the grid does not help: it sits
                outside the row, so the rail still came unpinned on the last
                line of related cards and drifted up the screen with a screen
                of page still to go. Padding here lengthens the row itself,
                which is what the rail stands on. */}
            <div className="min-w-0 lg:order-1 lg:pb-28">
              {/* Padding on the sheet, on a phone as well as a desktop.
                  It was `px-0 py-2`: the tint started eight pixels above the
                  first line and ended flush with the sides of the text, so
                  the prose was sitting on the very edge of the paper rather
                  than on the paper.

                  The horizontal padding is bought with a bleed rather than
                  taken out of the measure. `-mx-5` cancels `container-site`'s
                  own padding so the sheet runs the full width of the screen,
                  then `px-5` puts the text back exactly where it was. The
                  measure is unchanged — the reader gains a margin they can
                  see instead of losing four characters a line.

                  `w-full` had to go with it: on an explicit `width: 100%`
                  box the negative right margin is dropped as over-constrained
                  and the sheet slides sideways. Block width is already the
                  full column. */}
              <div
                ref={proseRef}
                className="paper -mx-5 max-w-[46rem] px-5 py-9 sm:mx-0 sm:px-10 sm:py-12 lg:px-14"
                style={{ "--reading-scale": scale } as React.CSSProperties}
              >
                <ArticleBody story={story} />

                {/* Imported work points back at the version its author
                    maintains. If this copy and the original ever drift apart,
                    a reader can see which is which instead of having to trust
                    whichever one they happened to land on. */}
                {story.sourceUrl && (
                  <Reveal variant="fade-up" className="mt-12 border-t border-border pt-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      First published on{" "}
                      <a
                        href={story.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline-grow font-semibold text-primary"
                      >
                        {story.publication ?? "the original site"}
                      </a>
                      .
                    </p>
                  </Reveal>
                )}

                <Reveal variant="fade-up" className="mt-14 border-t border-border pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rule-label mr-2">Filed under</span>
                    {story.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>

              {/* Two across, not three. The column is ~290px narrower than
                  the container this used to span, and three cards in what is
                  left are narrower than the standfirst above them. */}
              {related.length > 0 && (
                <section className="mt-24 sm:mt-28">
                  <SectionHeading
                    label="Keep reading"
                    title="Related work"
                    action={{ href: "/stories", label: "All stories" }}
                  />
                  <Stagger className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2">
                    {related.map((item, i) => (
                      <StaggerItem key={item.id} index={i}>
                        <StoryCard story={item} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </section>
              )}
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

