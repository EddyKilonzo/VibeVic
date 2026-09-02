import type { Block, Story } from "@/data/types";
import { sentences, textUnits, words } from "./text";

/**
 * Advice about the writing, measured rather than guessed.
 *
 * ── How this differs from `checks.ts` ────────────────────────────────────
 * Those are observations about correctness — a figure with nobody attached to
 * it, two sentences that contradict each other, a name spelled two ways. They
 * are about whether the piece is *right*.
 *
 * These are about whether it is *readable*, which is a different question and
 * one a machine can genuinely help with, because the things that make prose
 * hard to read are largely countable: sentences that all run the same length,
 * paragraphs nobody will start, verbs hidden inside nouns, adverbs propping up
 * weak verbs, a first sentence that says nothing.
 *
 * ── Everything here is measured, and every note says the measurement ─────
 * The rule the whole folder is built on holds: the same draft always produces
 * the same output, and every note names the text behind it. There is no score
 * out of ten, no "quality" figure, and no comparison to anybody else's
 * writing. A tip that cannot show its working is an opinion, and an opinion
 * dressed as an analysis is worse than no tip at all.
 *
 * ── And every one of them is refusable ───────────────────────────────────
 * Long sentences are sometimes the point. Passive voice is correct when the
 * actor is unknown or deliberately withheld — "the documents were leaked" is
 * not a weaker sentence than a guess about who leaked them, it is a more
 * honest one, and in this newsroom it may be the only publishable form. So
 * the wording of every tip is "this is what is here", never "fix this", and
 * the passive note says out loud when it is probably right.
 */

export type TipKind =
  | "sentence-length"
  | "rhythm"
  | "paragraph-length"
  | "passive"
  | "adverbs"
  | "nominalisation"
  | "opening"
  | "readability";

export interface Tip {
  id: string;
  kind: TipKind;
  /** The measurement, stated. */
  title: string;
  /** What it means for a reader, and what to consider. Never an instruction. */
  detail: string;
  /** Blocks it points at, so the writer can go and look. */
  blockIds: string[];
  /** The exact text behind it. */
  evidence?: string;
}

let counter = 0;
const id = (kind: string) => `${kind}_${++counter}`;

/* ── Thresholds ───────────────────────────────────────────────────────────
 *
 * Named, and every one of them defensible out loud rather than tuned until
 * the output looked nice. They are all on the generous side: a check that
 * fires on ordinary prose is one a writer learns to scroll past, and then it
 * is not firing on the paragraph that needed it either.
 */

/** Beyond this a sentence usually has to be re-read. Plain-English guidance. */
const LONG_SENTENCE = 34;

/** A paragraph this long is one a reader's eye skips on a phone. */
const LONG_PARAGRAPH_WORDS = 120;

/** Below this, sentence lengths are so even the prose drones. */
const RHYTHM_FLOOR = 5;

/** Adverbs above this share of words is usually verbs being propped up. */
const ADVERB_SHARE = 0.04;

/* ── Sentence length and rhythm ──────────────────────────────────────── */

/**
 * Sentences a reader has to go back to the start of.
 *
 * Reports the longest few rather than every one over the line. A list of
 * nineteen sentences is not advice, it is a complaint — and the writer who
 * shortens the worst three has usually fixed the paragraph they were in.
 */
export function findLongSentences(body: Block[]): Tip[] {
  const found: { text: string; length: number; blockId: string }[] = [];

  for (const unit of textUnits(body)) {
    // Quotes are exempt, and not as a convenience. A quote is what somebody
    // actually said; editing it for length is the one edit a newsroom must
    // never make silently, so flagging it invites exactly the wrong fix.
    if (unit.kind === "quote" || unit.kind === "heading") continue;

    for (const sentence of sentences(unit.text)) {
      const length = words(sentence).length;
      if (length > LONG_SENTENCE) {
        found.push({ text: sentence, length, blockId: unit.blockId });
      }
    }
  }

  return found
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map((hit) => ({
      id: id("long"),
      kind: "sentence-length" as const,
      title: `A ${hit.length}-word sentence`,
      detail:
        "Long sentences are not wrong, but a reader holds the beginning in their head until " +
        "the end arrives. If there are two ideas in here, a full stop between them is free.",
      blockIds: [hit.blockId],
      evidence: hit.text,
    }));
}

/**
 * Sentences that are all the same length.
 *
 * ── Why variance and not average ─────────────────────────────────────────
 * Average sentence length says almost nothing: eighteen words on average can
 * be a lively mix of five and thirty, or forty sentences of eighteen. The
 * second one drones, and it is the failure that writers cannot hear in their
 * own copy because they wrote each sentence separately.
 *
 * Standard deviation is the measurement that separates the two, and it is
 * reported as itself rather than as a grade.
 */
export function findRhythm(body: Block[]): Tip[] {
  const lengths = textUnits(body)
    .filter((unit) => unit.kind === "paragraph")
    .flatMap((unit) => sentences(unit.text).map((sentence) => words(sentence).length))
    .filter((length) => length > 0);

  // Below a dozen sentences there is not enough to measure, and saying
  // something anyway would be a statistic invented from four numbers.
  if (lengths.length < 12) return [];

  const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length;
  const spread = Math.sqrt(variance);

  if (spread >= RHYTHM_FLOOR) return [];

  return [
    {
      id: id("rhythm"),
      kind: "rhythm",
      title: `Sentences are running at a very even ${Math.round(mean)} words`,
      detail:
        `The spread across ${lengths.length} sentences is ${spread.toFixed(1)} words, which is ` +
        "unusually flat. Even lengths read as a drone however good the sentences are — a short " +
        "one after two long ones is the cheapest way to break it.",
      blockIds: [],
    },
  ];
}

/* ── Paragraphs ──────────────────────────────────────────────────────── */

export function findLongParagraphs(body: Block[]): Tip[] {
  return textUnits(body)
    .filter((unit) => unit.kind === "paragraph")
    .map((unit) => ({ unit, count: words(unit.text).length }))
    .filter((entry) => entry.count > LONG_PARAGRAPH_WORDS)
    .slice(0, 3)
    .map((entry) => ({
      id: id("para"),
      kind: "paragraph-length" as const,
      title: `A ${entry.count}-word paragraph`,
      detail:
        "On a phone this is most of a screen with no visual break in it, which is where eyes " +
        "skip. There is usually a natural seam — a new fact, a change of subject, a turn in " +
        "the argument — and a paragraph break at it costs nothing.",
      blockIds: [entry.unit.blockId],
      evidence: entry.unit.text.slice(0, 160),
    }));
}

/* ── Passive voice ───────────────────────────────────────────────────── */

const BE = /\b(?:is|are|was|were|be|been|being)\b/i;
/** Past participles that a `be` in front of usually makes passive. */
const PARTICIPLE =
  /\b(?:\w+ed|given|taken|seen|shown|known|held|made|said|told|found|paid|built|sent|written|driven|drawn|brought|caught|left|kept|lost|met|put|set|won)\b/i;

/**
 * Sentences in the passive voice.
 *
 * ── Why this note is careful in a way the others are not ─────────────────
 * Almost every style guide says to prefer the active voice, and almost every
 * automated tool applies that as a rule. In a newsroom it is not one.
 * "The documents were leaked" is not a weaker sentence than a guess about who
 * leaked them — it is the more honest one, and where a source is being
 * protected it may be the only publishable form.
 *
 * So this counts, and says what it counted, and says out loud that the
 * construction is often correct here. It never says "rewrite this".
 *
 * ── And the detection is approximate, which is admitted ──────────────────
 * A `be` verb followed by something that looks like a participle. That misses
 * some passives and catches some innocents — "he was tired" — and a real
 * parser is not worth the weight for a note whose whole content is "have a
 * look at these". The count is reported with the sentences behind it so the
 * writer can see immediately which ones are real.
 */
export function findPassive(body: Block[]): Tip[] {
  const hits: { text: string; blockId: string }[] = [];

  for (const unit of textUnits(body)) {
    if (unit.kind !== "paragraph") continue;
    for (const sentence of sentences(unit.text)) {
      const after = sentence.split(BE)[1];
      if (BE.test(sentence) && after && PARTICIPLE.test(after.split(/\s+/).slice(0, 3).join(" "))) {
        hits.push({ text: sentence, blockId: unit.blockId });
      }
    }
  }

  const total = sentences(textUnits(body).map((u) => u.text).join(" ")).length;
  // A handful in a long piece is ordinary prose, not a pattern worth a note.
  if (hits.length < 3 || (total > 0 && hits.length / total < 0.2)) return [];

  return [
    {
      id: id("passive"),
      kind: "passive",
      title: `${hits.length} sentences look passive`,
      detail:
        "Worth a look rather than a rule. The passive is right when the actor is unknown or " +
        "is being protected — “the documents were leaked” is more honest than a guess — and " +
        "it is limp when the actor is sitting right there in the sentence.",
      blockIds: [...new Set(hits.map((hit) => hit.blockId))],
      evidence: hits[0]?.text,
    },
  ];
}

/* ── Adverbs ─────────────────────────────────────────────────────────── */

/** `-ly` adverbs that are almost always doing a weak verb's work. */
const HEDGES = new Set([
  "very", "really", "quite", "rather", "somewhat", "fairly", "extremely",
  "incredibly", "totally", "completely", "absolutely", "literally", "basically",
  "actually", "definitely", "certainly", "clearly", "obviously", "simply", "just",
]);

export function findAdverbs(body: Block[]): Tip[] {
  const all = textUnits(body)
    .filter((unit) => unit.kind === "paragraph")
    .flatMap((unit) => words(unit.text).map((word) => ({ word, blockId: unit.blockId })));

  if (all.length < 120) return [];

  const flagged = all.filter(
    (entry) => HEDGES.has(entry.word) || (entry.word.endsWith("ly") && entry.word.length > 5),
  );

  if (flagged.length / all.length < ADVERB_SHARE) return [];

  const sample = [...new Set(flagged.map((entry) => entry.word))].slice(0, 8);

  return [
    {
      id: id("adverb"),
      kind: "adverbs",
      title: `${flagged.length} adverbs and hedges in ${all.length} words`,
      detail:
        `Including ${sample.map((word) => `“${word}”`).join(", ")}. Most of them are holding up ` +
        "a verb that could do the job alone — “ran quickly” is “sprinted” — and the hedges " +
        "(“very”, “quite”, “clearly”) usually make a claim sound less certain, not more.",
      blockIds: [...new Set(flagged.map((entry) => entry.blockId))].slice(0, 6),
    },
  ];
}

/* ── Buried verbs ────────────────────────────────────────────────────── */

/**
 * Verbs turned into nouns — the register that makes official prose unreadable.
 *
 * "Made an investigation into" is "investigated". Institutions write like this
 * because it removes the actor, and a reporter quoting a report can absorb the
 * habit without noticing. Detected on the endings that produce it, and only
 * where a light verb is sitting in front, which is what separates
 * "the investigation" (a thing) from "conducted an investigation" (a verb in
 * disguise).
 */
const LIGHT_VERB =
  /\b(?:make|makes|made|conduct|conducted|carry out|carried out|undertake|undertook|perform|performed|provide|provided|give|gave|reach|reached)\s+(?:an?|the)?\s*(\w+(?:tion|ment|ance|ence|ity|sion))\b/gi;

export function findBuriedVerbs(body: Block[]): Tip[] {
  const hits: { phrase: string; blockId: string }[] = [];

  for (const unit of textUnits(body)) {
    if (unit.kind !== "paragraph") continue;
    for (const match of unit.text.matchAll(LIGHT_VERB)) {
      hits.push({ phrase: match[0], blockId: unit.blockId });
    }
  }

  if (hits.length === 0) return [];

  return [
    {
      id: id("buried"),
      kind: "nominalisation",
      title: `${hits.length} verb${hits.length === 1 ? "" : "s"} buried inside a noun`,
      detail:
        `${hits.slice(0, 3).map((hit) => `“${hit.phrase}”`).join(", ")}. Institutions write this ` +
        "way because it removes whoever did the thing, and it is catching — a report quoted " +
        "closely enough will pull the register in with it. The plain verb is usually shorter " +
        "and always names the actor.",
      blockIds: [...new Set(hits.map((hit) => hit.blockId))],
      evidence: hits[0]?.phrase,
    },
  ];
}

/* ── The opening ─────────────────────────────────────────────────────── */

/**
 * The first sentence, which is the only one most readers are guaranteed to
 * read.
 *
 * Two failures worth naming, and no attempt at a third. A first sentence that
 * is very long asks for patience before it has earned any; one that names
 * nothing concrete — no person, no place, no number, no date — is a throat
 * clear. Neither is a verdict on the writing; both are answerable in a
 * sentence.
 */
export function findOpening(story: Story): Tip[] {
  const first = textUnits(story.body).find((unit) => unit.kind === "paragraph");
  if (!first) return [];

  const opener = sentences(first.text)[0];
  if (!opener) return [];

  const length = words(opener).length;
  if (length > 30) {
    return [
      {
        id: id("open"),
        kind: "opening",
        title: `The first sentence is ${length} words`,
        detail:
          "The opening is the only sentence you can count on being read. A long one asks the " +
          "reader for patience before the piece has given them a reason to have any.",
        blockIds: [first.blockId],
        evidence: opener,
      },
    ];
  }

  // Something concrete: a capitalised name mid-sentence, a number, or a date.
  const concrete = /\d|\b[A-Z][a-z]{2,}\b/.test(opener.slice(opener.indexOf(" ") + 1));
  if (!concrete) {
    return [
      {
        id: id("open"),
        kind: "opening",
        title: "The first sentence names nothing specific",
        detail:
          "No person, place, number or date in it. Openings that begin in the abstract — “in " +
          "recent years”, “it is often said” — are throat-clearing, and the concrete detail " +
          "that would hook a reader is usually already in the second paragraph.",
        blockIds: [first.blockId],
        evidence: opener,
      },
    ];
  }

  return [];
}

/* ── Readability ─────────────────────────────────────────────────────── */

/**
 * Roughly how much schooling the prose assumes, by Flesch–Kincaid.
 *
 * ── Why a formula from 1975, and why it is reported as a range ───────────
 * Because it is transparent: it counts words per sentence and syllables per
 * word, and nothing else. Every modern alternative is a model, and a model
 * cannot tell a journalist *why* it thinks their piece is hard — which is the
 * only part that would help.
 *
 * Its limits are real and worth stating rather than hiding: it does not know
 * what the words mean, so a page of short familiar words scores easy however
 * incoherent it is, and a piece full of necessary long proper nouns scores
 * hard when it is perfectly clear. So the number is offered as a bearing, not
 * a target, and it is only shown at all when it is well outside the range
 * general-audience journalism usually sits in.
 */
export function findReadability(body: Block[]): Tip[] {
  const prose = textUnits(body)
    .filter((unit) => unit.kind === "paragraph")
    .map((unit) => unit.text)
    .join(" ");

  const allSentences = sentences(prose);
  const allWords = words(prose);
  if (allSentences.length < 8 || allWords.length < 200) return [];

  const syllables = allWords.reduce((sum, word) => sum + syllablesIn(word), 0);
  const grade =
    0.39 * (allWords.length / allSentences.length) +
    11.8 * (syllables / allWords.length) -
    15.59;

  if (grade <= 14) return [];

  return [
    {
      id: id("read"),
      kind: "readability",
      title: `Reading level around grade ${Math.round(grade)}`,
      detail:
        "General-audience reporting usually lands between 8 and 12. This is a bearing rather " +
        "than a target — the formula counts sentence length and syllables and knows nothing " +
        "about meaning, so necessary long names push it up on their own. If the long words " +
        "are load-bearing, ignore it.",
      blockIds: [],
    },
  ];
}

/**
 * Syllables, counted by vowel groups.
 *
 * Approximate and knowingly so — English spelling defeats anything short of a
 * dictionary. It is good enough for a score that is itself offered as a rough
 * bearing, and being wrong by a syllable here and there moves the grade by
 * less than the rounding already does.
 */
function syllablesIn(word: string): number {
  const cleaned = word.replace(/[^a-z]/g, "");
  if (cleaned.length <= 3) return 1;
  const groups = cleaned
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return groups?.length ?? 1;
}

/* ── The whole pass ──────────────────────────────────────────────────── */

/**
 * Every tip, in the order a writer would want to act on them.
 *
 * The opening first because it is the one sentence guaranteed to be read;
 * then the structural notes, which change paragraphs; then the word-level
 * ones, which are the last thing worth doing to a draft that may still be
 * restructured.
 */
export function craftTips(story: Story): Tip[] {
  counter = 0;
  return [
    ...findOpening(story),
    ...findLongParagraphs(story.body),
    ...findLongSentences(story.body),
    ...findRhythm(story.body),
    ...findPassive(story.body),
    ...findBuriedVerbs(story.body),
    ...findAdverbs(story.body),
    ...findReadability(story.body),
  ];
}
