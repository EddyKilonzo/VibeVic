"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/data/api";
import { PROFILE, genreName, relatedStories } from "@/data/content";
import { PORTRAIT } from "@/data/portraits";
import { PortraitFrame } from "@/components/media/PortraitFrame";
import { coverFor } from "@/lib/cover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/useAsync";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useReadingPosition } from "@/hooks/useReadingPosition";
import { useFollowAlong } from "@/hooks/useFollowAlong";
import { useVoice } from "@/context/VoiceProvider";
import { ImageReveal, Reveal, ScrollProgress, Stagger, StaggerItem } from "@/components/motion";
import { ArticleActionBar } from "@/components/story/ArticleActionBar";
import { ArticleBody } from "@/components/story/ArticleBody";
import { ArticleSections } from "@/components/story/ArticleSections";
import { SectionSheet } from "@/components/story/SectionSheet";
import { ReadingHUD } from "@/components/story/ReadingHUD";
import { ResumeReading } from "@/components/story/ResumeReading";
import { QuoteSelection } from "@/components/story/QuoteSelection";
import { ReadingControls, useReadingScale } from "@/components/story/ReadingControls";
import { PlaceholderNotice } from "@/components/story/PlaceholderNotice";
import { StoryCard } from "@/components/story/StoryCard";
import { ArticleSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/SectionHeading";

export default function Story({ slug }: { slug: string }) {
  const articleRef = useRef<HTMLElement>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const scale = useReadingScale();

  const { data: story, loading, error, reload } = useAsync(() => api.story(slug), [slug]);

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

  if (loading) return <ArticleSkeleton />;

  if (error || !story) {
    return (
      <div className="container-article pt-40">
        <ErrorState
          title="This story isn't here."
          description="The link may be wrong, or the piece may have been unpublished."
          onRetry={reload}
        />
        <div className="mt-8 text-center">
          <Button as={Link} href="/stories" variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to all stories
          </Button>
        </div>
      </div>
    );
  }

  const related = relatedStories(story);

  return (
    <>
      {/* Progress through the article itself, not the document — the footer
          and related rail should not count as reading. */}
      <ScrollProgress target={articleRef} />
      <SectionSheet
        story={story}
        activeIndex={activeSection}
        open={sectionsOpen}
        onClose={() => setSectionsOpen(false)}
      />
      <QuoteSelection story={story} target={articleRef} />

      {/* The bottom readout. Suppressed on a phone while the voice transport
          is up — they want the same corner, and the transport is the one the
          reader explicitly asked for. */}
      <ReadingHUD
        target={articleRef}
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
        <header className="relative isolate flex min-h-[58vh] items-end overflow-hidden bg-brand-ink-deep pb-10 pt-32 sm:min-h-[66vh] sm:pb-14 sm:pt-40">
          <ImageReveal
            src={coverFor(story.slug)}
            alt=""
            ratio="16/9"
            priority
            immediate
            className="absolute inset-0 -z-10 h-full w-full"
            imgClassName="object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-ink-deep/85 via-brand-ink-deep/55 to-brand-ink-deep/95"
          />

          <div className="container-site relative">
            <div className="max-w-[46rem]">
              <Reveal variant="fade-up" distance="sm">
                <Link
                  href={`/stories?genre=${story.genre}`}
                  className="focus-ring underline-grow text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-sky"
                >
                  {genreName(story.genre)}
                </Link>
              </Reveal>

              <Reveal variant="fade-up" delay={60}>
                <h1 className="font-display mt-4 text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-balance text-white sm:text-[3.1rem] lg:text-[3.6rem]">
                  {story.title}
                </h1>
              </Reveal>

              <Reveal variant="fade-up" delay={120}>
                <p className="mt-5 max-w-[52ch] text-pretty text-lg leading-relaxed text-white/80">
                  {story.dek}
                </p>
              </Reveal>

              <Reveal variant="fade-up" delay={160}>
                <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/70">
                  {/* Byline portrait. Decorative — the name beside it already
                      carries the attribution, so it stays out of the reading
                      order rather than repeating it to a screen reader. */}
                  <PortraitFrame
                    portrait={PORTRAIT}
                    size={40}
                    className="h-10 w-10 shrink-0 rounded-full ring-2 ring-white/25"
                  />
                  <span className="font-medium text-white">{PROFILE.name}</span>
                  <span aria-hidden className="h-3 w-px bg-white/30" />
                  <time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time>
                  <span aria-hidden className="h-3 w-px bg-white/30" />
                  <span>{story.readingMinutes} min read</span>
                  {story.publication && (
                    <>
                      <span aria-hidden className="h-3 w-px bg-white/30" />
                      <span>Originally in {story.publication}</span>
                    </>
                  )}
                </div>
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
              <div className="surface p-5 sm:p-6 lg:sticky lg:top-28">
                <ArticleActionBar story={story} />

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

              {/* Offered, never applied — see `useReadingPosition`. */}
              {saved !== null && (
                <ResumeReading progress={saved} target={articleRef} onDismiss={decline} />
              )}

              {/* Template pieces say so before a reader has invested any time
                  in them, which on this layout means beside the first
                  paragraph rather than after the last. */}
              {story.placeholder && (
                <div className="mt-4">
                  <PlaceholderNotice />
                </div>
              )}
            </aside>

            <div className="min-w-0 lg:order-1">
              <div
                className="paper w-full max-w-[46rem] px-0 py-2 sm:px-10 sm:py-12 lg:px-14"
                style={{ "--reading-scale": scale } as React.CSSProperties}
              >
                <ArticleBody story={story} />

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
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="container-site mt-28">
          <SectionHeading
            label="Keep reading"
            title="Related work"
            action={{ href: "/stories", label: "All stories" }}
          />
          <Stagger className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, i) => (
              <StaggerItem key={item.id} index={i}>
                <StoryCard story={item} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </>
  );
}
