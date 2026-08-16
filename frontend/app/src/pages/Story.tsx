"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/data/api";
import { genreName, relatedStories } from "@/data/content";
import { coverFor } from "@/lib/cover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/useAsync";
import { useFollowAlong } from "@/hooks/useFollowAlong";
import { useVoice } from "@/context/VoiceProvider";
import { ImageReveal, Reveal, ScrollProgress, Stagger, StaggerItem } from "@/components/motion";
import { ArticleActionBar } from "@/components/story/ArticleActionBar";
import { ArticleBody } from "@/components/story/ArticleBody";
import { StoryCard } from "@/components/story/StoryCard";
import { ArticleSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/SectionHeading";

export default function Story() {
  const { slug = "" } = useParams();
  const articleRef = useRef<HTMLElement>(null);

  const { data: story, loading, error, reload } = useAsync(() => api.story(slug), [slug]);

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

      <article
        ref={articleRef}
        className={cn(
          "pt-28 sm:pt-36",
          // Clears the mobile mini-player so it can never cover the last line.
          listening && "pb-24 lg:pb-0",
        )}
      >
        <header className="container-article">
          <Reveal variant="fade-up" distance="sm">
            <Link
              href={`/stories?genre=${story.genre}`}
              className="focus-ring kicker underline-grow"
            >
              {genreName(story.genre)}
            </Link>
          </Reveal>

          <Reveal variant="fade-up" delay={60}>
            <h1 className="font-display mt-3 text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-[3rem]">
              {story.title}
            </h1>
          </Reveal>

          <Reveal variant="fade-up" delay={120}>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{story.dek}</p>
          </Reveal>

          <Reveal variant="fade-up" delay={160}>
            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Mara Ellison</span>
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

            <ArticleActionBar story={story} />
          </Reveal>
        </header>

        <figure className="mx-auto mt-14 max-w-[1100px] px-0 sm:px-8">
          <ImageReveal
            src={coverFor(story.slug)}
            alt=""
            ratio="16/9"
            priority
            className="sm:rounded-sm"
          />
        </figure>

        <div className="container-article mt-14">
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
