"use client";

import { useMemo } from "react";
import { Play } from "lucide-react";
import type { Block, Story } from "@/data/types";
import { splitSentences } from "@/lib/voice";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";
import { useVoice } from "@/context/VoiceProvider";
import { ImageReveal, Reveal } from "@/components/motion";

/**
 * Renders the article and, while it is being spoken, shows where the voice is.
 *
 * The highlight is two-layer and deliberately quiet: the current paragraph
 * takes a pale wash with a rule in the left margin, and inside it the current
 * sentence darkens slightly. No marker-pen yellow, no bouncing cursor — the
 * page should still read as an article someone typeset, not as a reading app.
 *
 * Sentence tracking works by position rather than by string comparison: the
 * voice engine's segments were generated from these same blocks in the same
 * order, so the nth segment of a block is the nth sentence of that block.
 */
export function ArticleBody({ story }: { story: Story }) {
  const { article, segmentIndex, activeBlockId, state, seekToSegment } = useVoice();
  const listening = state === "playing" || state === "paused";

  /** Index of the spoken sentence within its own block. */
  const sentenceInBlock = useMemo(() => {
    if (!article || !activeBlockId) return -1;
    let position = -1;
    for (let i = 0; i <= segmentIndex && i < article.segments.length; i++) {
      if (article.segments[i].blockId === activeBlockId) position += 1;
    }
    return position;
  }, [article, activeBlockId, segmentIndex]);

  /** First segment index belonging to a block — for "play from here". */
  const firstSegmentOf = useMemo(() => {
    const map = new Map<string, number>();
    article?.segments.forEach((segment, i) => {
      if (!map.has(segment.blockId)) map.set(segment.blockId, i);
    });
    return map;
  }, [article]);

  return (
    <div className="article-body">
      {story.body.map((block) => {
        const active = listening && block.id === activeBlockId;
        const start = firstSegmentOf.get(block.id);

        return (
          <BlockView
            key={block.id}
            block={block}
            active={active}
            sentenceIndex={active ? sentenceInBlock : -1}
            canSeek={listening && start !== undefined}
            onSeek={() => start !== undefined && seekToSegment(start)}
          />
        );
      })}
    </div>
  );
}

interface BlockViewProps {
  block: Block;
  active: boolean;
  sentenceIndex: number;
  canSeek: boolean;
  onSeek: () => void;
}

function BlockView({ block, active, sentenceIndex, canSeek, onSeek }: BlockViewProps) {
  /** The left-gutter control that starts narration from this block. */
  const seekControl = canSeek ? (
    <button
      type="button"
      onClick={onSeek}
      aria-label="Read aloud from here"
      title="Read aloud from here"
      className={cn(
        "focus-ring absolute -left-11 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-primary lg:flex",
        "opacity-0 transition-opacity duration-normal hover:border-accent hover:text-accent",
        "group-hover/block:opacity-100 focus-visible:opacity-100",
      )}
    >
      <Play className="ml-px h-3 w-3" fill="currentColor" aria-hidden />
    </button>
  ) : null;

  switch (block.type) {
    case "paragraph": {
      // Split only while this block is being read; otherwise the paragraph
      // stays a single text node, which keeps selection and copy intact.
      const sentences = active ? splitSentences(block.text) : null;

      return (
        <p
          data-block-id={block.id}
          className={cn("group/block relative", active && "speaking")}
        >
          {seekControl}
          {sentences
            ? sentences.map((sentence, i) => (
                <span key={i} className={cn(i === sentenceIndex && "speaking-sentence font-medium")}>
                  {sentence}{" "}
                </span>
              ))
            : block.text}
        </p>
      );
    }

    case "heading":
      return (
        <Reveal variant="fade-up" distance="sm">
          <h2 data-block-id={block.id} className={cn("group/block relative", active && "speaking")}>
            {seekControl}
            {block.text}
          </h2>
        </Reveal>
      );

    case "quote":
      return (
        <Reveal variant="fade-up" distance="sm">
          <blockquote data-block-id={block.id} className={cn(active && "speaking")}>
            {block.text}
            {block.attribution && (
              <cite className="mt-3 block font-sans text-[0.8rem] not-italic tracking-wide text-muted-foreground">
                {block.attribution}
              </cite>
            )}
          </blockquote>
        </Reveal>
      );

    case "image":
      return (
        <figure data-block-id={block.id} className="my-10 -mx-5 sm:mx-0">
          <ImageReveal src={coverFor(block.src)} alt={block.alt} ratio="16/9" />
          {block.caption && (
            <figcaption
              className={cn(
                "mt-3 px-5 font-sans text-[0.8rem] leading-relaxed text-muted-foreground sm:px-0",
                active && "speaking",
              )}
            >
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case "list":
      return (
        <ul
          data-block-id={block.id}
          className={cn("mb-7 space-y-3 pl-5", active && "speaking")}
        >
          {block.items.map((item, i) => (
            <li key={i} className="relative pl-1 marker:text-accent">
              <span
                aria-hidden
                className="absolute -left-4 top-[0.85em] h-px w-2.5 bg-accent"
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case "divider":
      return <hr className="my-12 border-border" />;
  }
}
