"use client";

import { useMemo } from "react";
import { Play } from "lucide-react";
import type { Block, ImageBlock, Story } from "@/data/types";
import { Inline } from "./Inline";
import { splitSentences } from "@/lib/voice";
import { blockImage } from "@/lib/cover";
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
                  <Inline text={sentence} />{" "}
                </span>
              ))
            : <Inline text={block.text} />}
        </p>
      );
    }

    case "heading":
      return (
        // The one place on the site that does *not* replay. Everywhere else a
        // reveal firing again is a nice thing to scroll back into; inside a
        // piece somebody is reading, a heading that fades out behind them and
        // fades back in when they check a line is the page moving while they
        // work. Reading beats motion here.
        <Reveal variant="fade-up" distance="sm" repeat={false}>
          <h2 data-block-id={block.id} className={cn("group/block relative", active && "speaking")}>
            {seekControl}
            <Inline text={block.text} />
          </h2>
        </Reveal>
      );

    case "quote":
      return (
        // Same reasoning as the heading above: prose does not replay.
        <Reveal variant="fade-up" distance="sm" repeat={false}>
          <blockquote data-block-id={block.id} className={cn(active && "speaking")}>
            <Inline text={block.text} />
            {block.attribution && (
              <cite className="mt-3 block font-sans text-[0.8rem] not-italic tracking-wide text-muted-foreground">
                {block.attribution}
              </cite>
            )}
          </blockquote>
        </Reveal>
      );

    case "image":
      /**
       * A block that was never given a picture shows the reader nothing.
       *
       * `src` used to hold an id into the editor's own IndexedDB store, which
       * resolved to a blob URL alive only in the browser that made it. Those
       * ids outlived the scheme: three of them sit at the foot of the Abraham
       * piece, and because `blockImage` falls back to generated cover art for
       * anything that is not an address, a reader was served three panels of
       * blue gradient with no caption, no alt text and nothing to look at.
       *
       * Generated art is right for a *cover*, which must exist for a card to
       * be drawn at all. Inside an article it is decoration standing where a
       * photograph was meant to be, so this renders nothing instead. The block
       * is still in the record and still in the editor, where the writer can
       * give it a picture or delete it — the reader simply stops paying for a
       * mistake in the tooling.
       */
      if (!hasPicture(block.src)) return null;

      return (
        <figure
          data-block-id={block.id}
          className={cn("my-10", figureWidth(block.size))}
        >
          <ImageReveal
            // 1280: the article column tops out well below this, so asking for
            // the measure rather than the original is the difference between
            // tens of KB and megabytes. A `small` picture is drawn at under
            // two-thirds of that, and asking for the same file would be
            // sending a reader bytes they will never see.
            src={blockImage(block.src, block.size === "small" ? 800 : 1280)}
            alt={block.alt}
            // The writer's choice, defaulting to the crop every block written
            // before this option existed was drawn in.
            ratio={block.ratio ?? "16/9"}
            sizes={
              block.size === "small"
                ? "(min-width: 640px) 24rem, 100vw"
                : "(min-width: 640px) 46rem, 100vw"
            }
            className="rounded-lg shadow-card"
          />
          <FigureCaption block={block} active={active} />
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
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );

    case "divider":
      return <hr className="my-12 border-border" />;
  }
}

/** Whether an image block's `src` is an address a reader's browser can fetch. */
function hasPicture(src: string): boolean {
  return /^(https?:)?\/\//.test(src) || src.startsWith("/") || src.startsWith("data:");
}

/**
 * How wide the writer asked for the picture to be.
 *
 * The three sizes are expressed against the sheet the article is set on
 * (`paper`, `max-w-[46rem]` with `px-5 sm:px-10 lg:px-14`), which is why the
 * numbers here are the sheet's own padding rather than percentages:
 *
 *   small   under two-thirds of the measure, centred — a portrait, a
 *           screenshot, a document. Something to read *beside* a point.
 *   column  the measure, which is where every image sat before this existed.
 *           On a phone it still bleeds to the sheet's edges, because a 20px
 *           margin either side of a picture on a 390px screen is a frame
 *           around nothing.
 *   wide    out to the sheet's edges on every screen, cancelling the padding
 *           the text is set in. It stops there rather than breaking into the
 *           page: the rail sits alongside this column, and a picture that
 *           reached past the paper would collide with it.
 */
function figureWidth(size: ImageBlock["size"]): string {
  switch (size) {
    case "small":
      return "mx-auto max-w-[24rem]";
    case "wide":
      return "-mx-5 sm:-mx-10 lg:-mx-14";
    default:
      return "-mx-5 sm:mx-0";
  }
}

/**
 * The caption, and the credit under it.
 *
 * ── Why they are drawn differently ───────────────────────────────────────
 * They are two different statements. A caption is reporting — it says what is
 * happening in the picture, it is read aloud with the article, and it can be
 * a full sentence. A credit is attribution: a name, boilerplate, the same
 * shape every time. Setting both in the same run of small caps made the
 * sentence hard work and the name no easier to find, so the caption is now
 * ordinary sentence case and only the credit keeps the small caps, which is
 * the job small caps are actually good at.
 */
function FigureCaption({
  block,
  active,
}: {
  block: Extract<Block, { type: "image" }>;
  active: boolean;
}) {
  const { caption, credit } = splitLegacyCaption(block);
  if (!caption && !credit) return null;

  return (
    <figcaption
      className={cn(
        "mt-3 px-5 font-sans text-[0.8rem] leading-relaxed text-muted-foreground sm:px-0",
        active && "speaking",
      )}
    >
      {caption && (
        <span className="figure-caption-text">
          <Inline text={caption} />
        </span>
      )}
      {credit && (
        <span className="figure-credit">
          {caption ? " " : null}
          {credit}
        </span>
      )}
    </figcaption>
  );
}

/**
 * Reads a block's caption and credit, splitting a legacy caption if it holds
 * both.
 *
 * ── Why a heuristic rather than a migration ──────────────────────────────
 * Every written piece on this site was imported from WordPress, and the
 * importer joined the caption and the credit with a bare slash. Splitting the
 * schema fixes what is written from now on and does nothing for the archive,
 * which is all of it — so the fallback is what actually makes the change
 * visible to a reader.
 *
 * ── And why it is this narrow ────────────────────────────────────────────
 * A guess that mangles a caption is worse than a caption with a slash in it,
 * so every condition below has to hold before anything is split:
 *
 *   - the block carries no explicit `credit`, so a block edited since the
 *     change is never second-guessed;
 *   - there is exactly one "/" in the string, which rules out URLs, dates
 *     written 12/03/2026, and fractions;
 *   - the tail is short and the head is long, which is the shape of
 *     "a sentence about the picture" + "a name" and not of "and/or";
 *   - the tail is not glued to a word that suggests a path.
 *
 * Anything that fails is left exactly as it was written.
 */
export function splitLegacyCaption(block: Extract<Block, { type: "image" }>): {
  caption: string;
  credit: string;
} {
  const caption = block.caption?.trim() ?? "";
  const credit = block.credit?.trim() ?? "";

  if (credit || !caption) return { caption, credit };
  if (caption.split("/").length !== 2) return { caption, credit: "" };

  const [head, tail] = caption.split("/").map((part) => part.trim());
  if (!head || !tail) return { caption, credit: "" };
  if (head.length < 20 || tail.length > 60) return { caption, credit: "" };

  return { caption: head, credit: tail };
}
