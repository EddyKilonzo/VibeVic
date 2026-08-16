import type { Block } from "@/data/types";
import type { Chapter, Segment } from "./types";

/**
 * Turns article blocks into speakable segments.
 *
 * Only editorial content goes in. Navigation, metadata, share controls,
 * related-story rails and the player's own chrome are never part of the block
 * list, so they cannot be read aloud by accident — that is the main reason
 * articles are stored as blocks rather than as HTML.
 */

/** Average speaking rate at 1x, in words per minute. */
const WPM = 175;

/**
 * Abbreviations that end in a period without ending a sentence. Without this
 * guard, "Dr. Osei" becomes two utterances and the pause lands in the wrong
 * place.
 */
const ABBREVIATIONS = [
  "mr", "mrs", "ms", "dr", "prof", "st", "sr", "jr", "vs", "etc", "e.g", "i.e",
  "fig", "no", "vol", "pp", "approx", "dept", "est", "inc", "ltd", "co",
];

/** Read naturally rather than letter-by-letter or as symbols. */
const SPOKEN: Array<[RegExp, string]> = [
  [/&/g, " and "],
  [/\bFOI\b/g, "F O I"],
  [/\bNHS\b/g, "N H S"],
  [/\bCEO\b/g, "C E O"],
  [/\bPDF\b/g, "P D F"],
  [/\bUK\b/g, "U K"],
  [/\bUS\b/g, "U S"],
  [/—/g, ", "],
  [/–/g, ", "],
  [/…/g, ", "],
  [/["""«»]/g, ""],
  [/\s+/g, " "],
];

const CURRENCY: Record<string, string> = { "£": "pounds", $: "dollars", "€": "euros" };

/**
 * Normalises a sentence for speech.
 *
 * Speech synthesis reads "$61.4m" as "dollar sixty one point four m". Money,
 * percentages and initialisms are the three cases that reliably break the
 * illusion, so they are rewritten before they reach the engine. The displayed
 * article text is untouched — this string is only ever spoken.
 */
export function toSpeakable(input: string): string {
  let text = input;

  // Money: "$61.4m" → "61.4 million dollars"
  text = text.replace(/([£$€])\s?([\d,]+(?:\.\d+)?)\s?(m|bn|k)?\b/gi, (_, sym, num, scale) => {
    const unit = CURRENCY[sym as string] ?? "";
    const scaleWord =
      scale?.toLowerCase() === "m"
        ? " million"
        : scale?.toLowerCase() === "bn"
          ? " billion"
          : scale?.toLowerCase() === "k"
            ? " thousand"
            : "";
    return `${num}${scaleWord} ${unit}`;
  });

  text = text.replace(/(\d)\s?%/g, "$1 per cent");

  for (const [pattern, replacement] of SPOKEN) {
    text = text.replace(pattern, replacement);
  }

  return text.trim();
}

/**
 * Splits a paragraph into sentences.
 *
 * Sentence-level segments are what make highlighting, chapter jumps and
 * resume-from-here work: each one is a separate utterance, so the engine
 * reports precise start and end boundaries even on browsers that expose no
 * word-boundary events at all.
 */
export function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let current = "";

  const tokens = text.split(/(?<=[.!?])\s+/);
  for (const token of tokens) {
    current = current ? `${current} ${token}` : token;

    const trailing = current.match(/(\S+)[.!?]$/);
    const word = trailing?.[1]?.toLowerCase().replace(/[^a-z.]/g, "");
    const isAbbrev = word && ABBREVIATIONS.includes(word.replace(/\.$/, ""));
    // A single initial ("J.") is never a sentence end either.
    const isInitial = /\b[a-z]\.$/i.test(current);

    if (!isAbbrev && !isInitial) {
      parts.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

export function estimateSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.6, (words / WPM) * 60);
}

export interface ExtractResult {
  segments: Segment[];
  chapters: Chapter[];
  /** Estimated running time at 1x, in seconds. */
  totalSeconds: number;
}

/**
 * Builds the full speech plan for an article.
 *
 * @param title    Spoken first, so audio-only listeners know what they opened.
 * @param blocks   The article body.
 */
export function extractArticle(title: string, blocks: Block[]): ExtractResult {
  const segments: Segment[] = [];
  const chapters: Chapter[] = [];
  let chapterIndex = 0;

  const push = (text: string, blockId: string, isHeading = false) => {
    const speakable = toSpeakable(text);
    if (!speakable) return;
    segments.push({
      id: `${blockId}-${segments.length}`,
      text: speakable,
      blockId,
      chapterIndex,
      isHeading,
      estimatedSeconds: estimateSeconds(speakable),
    });
  };

  // Chapter 0 is always the opening, whether or not the piece uses headings.
  chapters.push({ index: 0, title: "Introduction", startSegment: 0, seconds: 0 });
  push(title, "title", true);

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        chapterIndex += 1;
        chapters.push({
          index: chapterIndex,
          title: block.text,
          startSegment: segments.length,
          seconds: 0,
        });
        push(block.text, block.id, true);
        break;
      }
      case "paragraph": {
        for (const sentence of splitSentences(block.text)) push(sentence, block.id);
        break;
      }
      case "quote": {
        // Spoken with its attribution so a listener knows it was a quotation.
        push(`Quote. ${block.text}`, block.id);
        if (block.attribution) push(`End quote. ${block.attribution}.`, block.id);
        else push("End quote.", block.id);
        break;
      }
      case "list": {
        block.items.forEach((item, i) => push(`${i + 1}. ${item}`, block.id));
        break;
      }
      case "image": {
        // The picture cannot be heard; its caption carries the information.
        if (block.caption) push(`Image. ${block.caption}`, block.id);
        break;
      }
      case "divider":
        break;
    }
  }

  // Fold per-segment estimates back into the chapters.
  for (let i = 0; i < chapters.length; i++) {
    const start = chapters[i].startSegment;
    const end = i + 1 < chapters.length ? chapters[i + 1].startSegment : segments.length;
    chapters[i].seconds = segments
      .slice(start, end)
      .reduce((total, s) => total + s.estimatedSeconds, 0);
  }

  const totalSeconds = segments.reduce((total, s) => total + s.estimatedSeconds, 0);

  // An article with no headings gets no chapter rail, only a single span.
  return { segments, chapters, totalSeconds };
}
