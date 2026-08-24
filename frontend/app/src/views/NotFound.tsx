"use client";

import Link from "next/link";
import { usePublishedStories } from "@/hooks/useStories";
import { Reveal, Stagger, StaggerItem, TextReveal } from "@/components/motion";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  /**
   * Fetched here rather than passed in: `not-found` has no route of its own to
   * fetch for it, and three suggestions arriving a moment after the apology is
   * fine — nobody is reading this page for the list.
   */
  const { data } = usePublishedStories();
  const suggestions = (data ?? []).slice(0, 3);

  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">404</p>
      </Reveal>

      <TextReveal
        as="h1"
        lines={["This page isn't", "where it used to be."]}
        className="font-display mt-3 text-[2.4rem] font-semibold leading-[1.06] tracking-tight sm:text-6xl"
        immediate
      />

      <Reveal variant="fade-up" delay={280}>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
          The link may be old, or the piece may have moved. Here is what has been published most
          recently.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button as={Link} href="/stories">
            All stories
          </Button>
          <Button as={Link} href="/" variant="outline">
            Back home
          </Button>
        </div>
      </Reveal>

      <Stagger className="mt-20 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((story, i) => (
          <StaggerItem key={story.id} index={i}>
            <StoryCard story={story} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
