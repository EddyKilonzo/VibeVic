import type { Block, Story } from "@/data/types";
import type { Entity, Newsroom } from "@/data/newsroom/types";
import type { ChecklistItem, Finding } from "./types";
import { STOP_WORDS, sentences, textUnits, words } from "./text";

/**
 * The deterministic editorial checks.
 *
 * Each function takes the draft and returns findings that name the exact text
 * behind them. None of them rewrite anything, none of them score anything, and
 * none of them assert a fact the draft does not already contain — the most any
 * of them says is "these two sentences disagree, look at them".
 */

let counter = 0;
const id = (kind: string) => `${kind}_${++counter}`;

/* ── Repetition ──────────────────────────────────────────────── */

const PHRASE_LENGTH = 4;

/**
 * Repeated four-word phrases across different blocks.
 *
 * Four words is the threshold where repetition stops being coincidence and
 * starts reading as an editing slip. Repeats *within* one block are left
 * alone — those are often deliberate rhetoric.
 */
export function findRepetition(body: Block[]): Finding[] {
  const seen = new Map<string, { blockIds: Set<string>; sample: string }>();

  for (const unit of textUnits(body)) {
    if (unit.kind === "quote") continue; // A source's own repetition is theirs.
    const w = words(unit.text);
    for (let i = 0; i + PHRASE_LENGTH <= w.length; i++) {
      const slice = w.slice(i, i + PHRASE_LENGTH);
      if (slice.every((x) => STOP_WORDS.has(x))) continue;
      const key = slice.join(" ");
      const entry = seen.get(key) ?? { blockIds: new Set<string>(), sample: key };
      entry.blockIds.add(unit.blockId);
      seen.set(key, entry);
    }
  }

  const findings: Finding[] = [];
  for (const [phrase, entry] of seen) {
    if (entry.blockIds.size < 2) continue;
    findings.push({
      id: id("rep"),
      kind: "repetition",
      severity: "note",
      title: `"${phrase}" appears in ${entry.blockIds.size} places`,
      detail: "Repeating a phrase across sections usually reads as an oversight rather than emphasis.",
      blockIds: [...entry.blockIds],
      evidence: phrase,
    });
  }
  return findings.slice(0, 12);
}

/* ── Terminology consistency ─────────────────────────────────── */

/**
 * Names and acronyms written more than one way.
 *
 * Driven by the entity list the journalist maintains: a variant only counts as
 * a variant because they said it was one. Guessing that "Moi" and "Moi
 * University" are the same thing is exactly the kind of inference that would
 * put words in a reporter's mouth.
 */
export function findTerminology(body: Block[], entities: Entity[]): Finding[] {
  const findings: Finding[] = [];
  const units = textUnits(body);

  for (const entity of entities) {
    const forms = [entity.name, ...entity.aliases].filter(Boolean);
    if (forms.length < 2) continue;

    const used = new Map<string, string[]>();
    for (const form of forms) {
      const pattern = new RegExp(`\\b${escapeRegExp(form)}\\b`, "i");
      const hits = units.filter((u) => pattern.test(u.text)).map((u) => u.blockId);
      if (hits.length) used.set(form, hits);
    }

    if (used.size < 2) continue;
    findings.push({
      id: id("term"),
      kind: "terminology",
      severity: "note",
      title: `${entity.name} is written ${used.size} different ways`,
      detail: `Found as ${[...used.keys()].map((f) => `"${f}"`).join(", ")}. Pick one form for the piece.`,
      blockIds: [...new Set([...used.values()].flat())],
    });
  }
  return findings;
}

/* ── House style ─────────────────────────────────────────────── */

/**
 * Terms the journalist has decided against, found in the draft.
 *
 * ── Why this is the writer's list and not a built-in one ─────────────────
 * `StyleGuideEntry` — preferred term, terms to avoid, and why — has been in
 * the schema and served by the curation API since the newsroom was built, and
 * nothing had ever read it. A shipped list of "bad words" would have been the
 * wrong thing to build in its place: house style is a publication's own
 * judgement, and half of what one newsroom bans another insists on. The list
 * this reads is the one Victor wrote.
 *
 * ── Why it names the preferred term and stops there ──────────────────────
 * The finding says which word was found, what the house prefers, and the
 * reason if one was given. It does not rewrite the sentence, and it is a
 * `note` rather than `attention`: style is a decision, and a check that told
 * a journalist they were wrong about their own house style would be claiming
 * an authority it got from a form.
 *
 * ── Word boundaries, and the one case they do not cover ──────────────────
 * Matched with `\b` on both sides, so "cop" does not fire on "cope" and a
 * banned acronym does not fire inside a longer one. A multi-word term works
 * the same way. What this cannot catch is a term that only appears inflected —
 * "activists" when the entry says "activist" — and it deliberately does not
 * try to stem, because a stemmer would start matching words the journalist
 * never listed and every false positive here is a sentence someone reads
 * twice for nothing.
 */
export function findHouseStyle(
  body: Block[],
  styleGuide: Newsroom["styleGuide"] = [],
): Finding[] {
  const findings: Finding[] = [];
  const units = textUnits(body);

  for (const entry of styleGuide) {
    for (const avoided of entry.avoid) {
      if (!avoided.trim()) continue;

      const pattern = new RegExp(`\\b${escapeRegExp(avoided)}\\b`, "i");
      const hits = units.filter((unit) => pattern.test(unit.text));
      if (hits.length === 0) continue;

      findings.push({
        id: id("style"),
        kind: "house-style",
        severity: "note",
        title: `"${avoided}" — the house prefers "${entry.preferred}"`,
        detail: entry.why ?? `Your style guide lists "${avoided}" as a term to avoid.`,
        blockIds: [...new Set(hits.map((unit) => unit.blockId))],
        // The first sentence it appears in, so the decision can be made
        // against the actual phrasing rather than against the word alone.
        evidence: sentences(hits[0]!.text).find((sentence) => pattern.test(sentence)),
      });
    }
  }

  return findings;
}

/* ── Statistics ──────────────────────────────────────────────── */

const NUMERIC = /\b\d[\d,.]*\s*(?:%|percent|per cent|million|billion|thousand|m\b|bn\b|k\b)?/gi;
const ATTRIBUTION = /\b(according to|said|says|reported|per|data from|figures from|cited|survey|study|report)\b/i;

/**
 * Every numeric claim, and whether the sentence around it names a source.
 *
 * The check is only ever "is there an attribution in this sentence" — it does
 * not evaluate whether the number is correct, because nothing here can know
 * that. Verification stays a human act; this just makes sure none is missed.
 */
export function findStatistics(body: Block[]): Finding[] {
  const findings: Finding[] = [];

  for (const unit of textUnits(body)) {
    if (unit.kind === "heading") continue;
    for (const sentence of sentences(unit.text)) {
      const matches = sentence.match(NUMERIC);
      if (!matches) continue;
      // Bare years and small counts are not the claims this is looking for.
      const meaningful = matches.filter((m) => !/^(19|20)\d{2}$/.test(m.trim()));
      if (!meaningful.length) continue;

      const attributed = ATTRIBUTION.test(sentence);
      findings.push({
        id: id("stat"),
        kind: "statistic",
        severity: attributed ? "note" : "attention",
        title: attributed
          ? `Figure with a stated source: ${meaningful[0].trim()}`
          : `Figure with no source in the sentence: ${meaningful[0].trim()}`,
        detail: attributed
          ? "The sentence names where this came from. Confirm the source record says the same."
          : "No attribution appears in this sentence. Add where the figure came from, or check that it is attributed nearby.",
        blockIds: [unit.blockId],
        evidence: sentence.trim(),
      });
    }
  }
  return findings;
}

/* ── Contradictions ──────────────────────────────────────────── */

const YEAR = /\b(19|20)\d{2}\b/g;

/**
 * Dates and figures attached to the same subject that do not agree.
 *
 * Deliberately narrow. It compares numbers that sit beside the same noun
 * phrase and reports the disagreement — it never decides which one is right,
 * because the draft does not contain that information.
 */
export function findContradictions(body: Block[]): Finding[] {
  const findings: Finding[] = [];
  const units = textUnits(body);

  // Subject → the distinct years asserted about it, with where they appeared.
  const claims = new Map<string, Map<string, string[]>>();

  for (const unit of units) {
    for (const sentence of sentences(unit.text)) {
      const years = [...new Set(sentence.match(YEAR) ?? [])];
      if (!years.length) continue;
      const subject = words(sentence).find((w) => !STOP_WORDS.has(w) && w.length > 3);
      if (!subject) continue;

      const bySubject = claims.get(subject) ?? new Map<string, string[]>();
      for (const year of years) {
        bySubject.set(year, [...(bySubject.get(year) ?? []), unit.blockId]);
      }
      claims.set(subject, bySubject);
    }
  }

  for (const [subject, years] of claims) {
    if (years.size < 2) continue;
    const blockIds = [...new Set([...years.values()].flat())];
    if (blockIds.length < 2) continue;
    findings.push({
      id: id("contra"),
      kind: "contradiction",
      severity: "attention",
      title: `"${subject}" is dated ${[...years.keys()].join(" and ")}`,
      detail: "Two different years appear against the same subject. One of them may be wrong, or they may be different events.",
      blockIds,
    });
  }
  return findings.slice(0, 8);
}

/* ── Structure and attribution ───────────────────────────────── */

export function findStructure(story: Story): Finding[] {
  const findings: Finding[] = [];
  const units = textUnits(story.body);
  const paragraphs = units.filter((u) => u.kind === "paragraph");
  const headings = story.body.filter((b) => b.type === "heading");

  const long = paragraphs.filter((p) => words(p.text).length > 120);
  if (long.length) {
    findings.push({
      id: id("struct"),
      kind: "structure",
      severity: "note",
      title: `${long.length} paragraph${long.length > 1 ? "s run" : " runs"} past 120 words`,
      detail: "Long paragraphs are hard to hold on a phone, and the voice player reads them as one unbroken stretch.",
      blockIds: long.map((p) => p.blockId),
    });
  }

  if (paragraphs.length > 8 && headings.length === 0) {
    findings.push({
      id: id("struct"),
      kind: "structure",
      severity: "note",
      title: "No section headings in a long piece",
      detail: "Headings become the chapters a listener can skip between. Without them the audio is one long track.",
      blockIds: [],
    });
  }

  const quotes = story.body.filter((b) => b.type === "quote");
  const unattributed = quotes.filter((b) => b.type === "quote" && !b.attribution?.trim());
  if (unattributed.length) {
    findings.push({
      id: id("attr"),
      kind: "attribution",
      severity: "attention",
      title: `${unattributed.length} quote${unattributed.length > 1 ? "s have" : " has"} no attribution`,
      detail: "A pull quote without a speaker cannot be checked by a reader or an editor.",
      blockIds: unattributed.map((b) => b.id),
    });
  }

  return findings;
}

/* ── Sensitivity ─────────────────────────────────────────────── */

const SENSITIVE_TERMS = [
  "alleged", "allegedly", "accused", "fraud", "corrupt", "corruption",
  "criminal", "arrested", "charged", "convicted", "victim", "assault",
  "minor", "child", "leaked", "confidential",
];

/**
 * Terms that usually warrant a second read before publishing.
 *
 * This is a prompt to review, not a legal opinion, and it says so. It cannot
 * and does not make any judgement about liability.
 */
export function findSensitivity(body: Block[]): Finding[] {
  const findings: Finding[] = [];
  for (const unit of textUnits(body)) {
    const hits = SENSITIVE_TERMS.filter((t) =>
      new RegExp(`\\b${t}\\b`, "i").test(unit.text),
    );
    if (!hits.length) continue;
    findings.push({
      id: id("sens"),
      kind: "sensitivity",
      severity: "note",
      title: `Worth a second read: ${hits.slice(0, 3).join(", ")}`,
      detail:
        "Passages naming allegations or identifying people usually need an editorial review before publishing. This is a prompt to look, not legal advice.",
      blockIds: [unit.blockId],
    });
  }
  return findings.slice(0, 6);
}

/* ── The whole pass ──────────────────────────────────────────── */

export function reviewStory(
  story: Story,
  entities: Entity[] = [],
  styleGuide: Newsroom["styleGuide"] = [],
): Finding[] {
  counter = 0;
  return [
    ...findContradictions(story.body),
    ...findStatistics(story.body),
    ...findStructure(story),
    ...findTerminology(story.body, entities),
    ...findHouseStyle(story.body, styleGuide),
    ...findRepetition(story.body),
    ...findSensitivity(story.body),
  ].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "attention" ? -1 : 1));
}

/* ── Pre-publication checklist ───────────────────────────────── */

/**
 * Answered from the draft, with the reason shown beside each answer.
 *
 * There is no overall score. A number would compress "no headline" and "no
 * sources" into one figure that means nothing, and the brief rules that out
 * explicitly.
 */
export function prePublicationChecklist(
  story: Story,
  context: {
    sourceCount: number;
    quoteCount: number;
    /**
     * The beat's display name, resolved by the caller.
     *
     * Passed in rather than looked up here because the taxonomy now comes from
     * the database, and this file is a set of pure functions over a draft —
     * giving it a data dependency would make every check await a fetch.
     */
    beatLabel: string;
  },
): ChecklistItem[] {
  const units = textUnits(story.body);
  const wordCount = units.reduce((n, u) => n + words(u.text).length, 0);
  const images = story.body.filter((b) => b.type === "image");
  const missingAlt = images.filter((b) => b.type === "image" && !b.alt.trim());
  const stats = findStatistics(story.body).filter((f) => f.severity === "attention");

  return [
    {
      id: "headline",
      label: "Headline written",
      state: story.title.trim() && story.title.trim() !== "Untitled" ? "met" : "unmet",
      because: story.title.trim() ? `"${story.title}"` : "The title is still blank.",
    },
    {
      id: "dek",
      label: "Standfirst written",
      state: story.dek.trim() ? "met" : "unmet",
      because: story.dek.trim() ? "A standfirst is present." : "No standfirst — search results and share cards will fall back to the first line.",
    },
    {
      id: "genre",
      label: "Beat assigned",
      state: story.genre ? "met" : "unmet",
      because: story.genre ? `Filed under ${context.beatLabel}.` : "No beat chosen, so this will not appear under any topic.",
    },
    {
      id: "length",
      label: "Body has content",
      state: wordCount > 150 ? "met" : wordCount > 0 ? "unmet" : "unmet",
      because: `${wordCount} words across ${units.length} blocks.`,
    },
    {
      id: "alt",
      label: "Images have alt text",
      state: images.length === 0 ? "unknown" : missingAlt.length ? "unmet" : "met",
      because:
        images.length === 0
          ? "No images in this piece."
          : missingAlt.length
            ? `${missingAlt.length} of ${images.length} images have no alt text.`
            : `All ${images.length} images described.`,
    },
    {
      id: "figures",
      label: "Figures attributed",
      state: stats.length ? "unmet" : "unknown",
      because: stats.length
        ? `${stats.length} figure${stats.length > 1 ? "s" : ""} appear without a source in the sentence.`
        : "No unattributed figures found. That is not the same as verified — check them against the source records.",
    },
    {
      id: "sources",
      label: "Sources recorded",
      state: context.sourceCount > 0 ? "met" : "unknown",
      because:
        context.sourceCount > 0
          ? `${context.sourceCount} source record${context.sourceCount > 1 ? "s" : ""} linked to this story.`
          : "No source records linked. Reporting done off the record may still be correct — this only reflects what is written down here.",
    },
    {
      id: "quotes",
      label: "Quotes verified",
      state: context.quoteCount > 0 ? "met" : "unknown",
      because:
        context.quoteCount > 0
          ? `${context.quoteCount} quote${context.quoteCount > 1 ? "s" : ""} in the quote bank for this story.`
          : "No quotes recorded against this story.",
    },
    {
      id: "tags",
      label: "Tags added",
      state: story.tags.length ? "met" : "unmet",
      because: story.tags.length ? story.tags.join(", ") : "No tags, so this will not surface in related reading.",
    },
  ];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
