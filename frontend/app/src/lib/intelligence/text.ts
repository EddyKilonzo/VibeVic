import type { Block } from "@/data/types";

/** Blocks that carry prose worth checking. Images and dividers carry none. */
export interface TextUnit {
  blockId: string;
  text: string;
  kind: Block["type"];
}

export function textUnits(body: Block[]): TextUnit[] {
  const units: TextUnit[] = [];
  for (const block of body) {
    switch (block.type) {
      case "paragraph":
      case "heading":
        units.push({ blockId: block.id, text: block.text, kind: block.type });
        break;
      case "quote":
        units.push({ blockId: block.id, text: block.text, kind: "quote" });
        break;
      case "list":
        units.push({ blockId: block.id, text: block.items.join(". "), kind: "list" });
        break;
      case "image":
        if (block.caption) units.push({ blockId: block.id, text: block.caption, kind: "image" });
        break;
      case "divider":
        break;
    }
  }
  return units;
}

/** Words, lowercased, punctuation stripped, contractions kept whole. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "rev", "hon",
  "e.g", "i.e", "etc", "vs", "no", "vol", "fig", "approx",
]);

/** Sentence split that does not break on "Dr." or "e.g.". */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let current = "";
  const parts = text.split(/(?<=[.!?])\s+/);

  for (const part of parts) {
    current = current ? `${current} ${part}` : part;
    const trailing = current.trimEnd();
    const lastWord = trailing.slice(0, -1).split(/\s+/).pop()?.toLowerCase().replace(/[^\w.]/g, "");
    const endsOnAbbreviation = lastWord ? ABBREVIATIONS.has(lastWord) : false;
    if (!endsOnAbbreviation) {
      out.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

/** Stop words are excluded from repetition and terminology checks. */
export const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with",
  "as", "by", "from", "that", "this", "these", "those", "it", "its", "is", "was",
  "are", "were", "be", "been", "has", "have", "had", "he", "she", "they", "them",
  "his", "her", "their", "we", "our", "you", "your", "i", "not", "no", "so", "if",
  "than", "then", "there", "which", "who", "what", "when", "where", "how", "all",
  "one", "two", "up", "out", "about", "into", "over", "after", "before", "more",
  "said", "says", "also", "would", "could", "should", "will", "can", "may",
]);
