/**
 * The newsroom model — everything behind a published story.
 *
 * ── Privacy is a property of the type, not of the screen ──────────────────
 * Records here describe reporting in progress: who talked, what they said off
 * the record, which documents back a claim. None of it is publishable by
 * default. Every record that can carry sensitive material declares its own
 * `visibility`, and the public data layer never imports this module — the only
 * way any of it reaches a reader is a deliberate copy into a `Story` block.
 *
 * `confidential` is stronger than `private`: it marks material where the
 * *existence* of the record, not only its contents, must not leak. Source
 * protection is the reason this model exists at all.
 */

export type Visibility = "confidential" | "private" | "publishable";

/** Common shape for everything the journalist creates and owns. */
export interface Record_ {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Ideas and pitches ───────────────────────────────────────── */

export type IdeaStage = "spark" | "researching" | "pitched" | "commissioned" | "dropped";

export interface Idea extends Record_ {
  title: string;
  note: string;
  tags: string[];
  genre: string;
  /** The journalist's own ranking. Never computed — an invented priority
   *  score would be a machine pretending to know what matters. */
  priority: "low" | "medium" | "high";
  stage: IdeaStage;
  /** Set once the idea becomes a story. */
  storyId?: string;
}

export interface Pitch extends Record_ {
  ideaId?: string;
  title: string;
  /** The specific angle, not the subject area. */
  angle: string;
  whyItMatters: string;
  whatIsKnown: string;
  whatIsUnknown: string;
  /** Ids into `Source`. Kept as references so a pitch never copies contact
   *  details it would then be responsible for protecting. */
  sourceIds: string[];
  targetPublication?: string;
  deadline?: string;
  storyId?: string;
}

/* ── Sources, quotes, interviews ─────────────────────────────── */

export type SourceStatus = "unverified" | "verifying" | "verified" | "disputed";

export interface Source extends Record_ {
  /** May be a pseudonym when `visibility` is confidential. */
  name: string;
  role?: string;
  organisation?: string;
  url?: string;
  /** ISO date the URL was last actually opened — not a guess. */
  accessedAt?: string;
  notes: string;
  status: SourceStatus;
  visibility: Visibility;
  /** Real identity, stored separately so a UI can show the record without it. */
  protectedIdentity?: string;
  storyIds: string[];
}

export interface Quote extends Record_ {
  text: string;
  speaker: string;
  speakerRole?: string;
  /** When it was said, which is not when it was written down. */
  saidAt?: string;
  sourceId?: string;
  interviewId?: string;
  status: SourceStatus;
  visibility: Visibility;
  storyIds: string[];
}

export interface Interview extends Record_ {
  interviewee: string;
  role?: string;
  purpose: string;
  conductedAt?: string;
  /** Free notes. Transcripts, if a recording is ever made, live here too. */
  notes: string;
  keyQuoteIds: string[];
  followUps: string[];
  visibility: Visibility;
  storyIds: string[];
}

/* ── Evidence and entities ───────────────────────────────────── */

export type EntityKind = "person" | "organisation" | "location" | "project" | "document";

export interface Entity extends Record_ {
  kind: EntityKind;
  name: string;
  /** Other spellings and acronyms seen in the copy. Feeds the terminology
   *  check, which is why it is a list rather than a single alias. */
  aliases: string[];
  note: string;
  visibility: Visibility;
}

export interface EvidenceItem extends Record_ {
  title: string;
  /** What this actually demonstrates — the claim it supports. */
  supports: string;
  sourceId?: string;
  entityIds: string[];
  /** Free-text link or file reference. No upload pipeline exists yet, and a
   *  fake one would imply documents are stored when they are not. */
  reference?: string;
  visibility: Visibility;
  storyIds: string[];
}

export interface TimelineEvent extends Record_ {
  /** ISO date of the event itself. */
  occurredAt: string;
  what: string;
  entityIds: string[];
  evidenceIds: string[];
  storyIds: string[];
}

/* ── Working notes and deadlines ─────────────────────────────── */

export interface Note extends Record_ {
  title: string;
  body: string;
  storyId?: string;
  visibility: Visibility;
}

export interface Deadline extends Record_ {
  storyId?: string;
  label: string;
  /** ISO datetime. */
  dueAt: string;
  done: boolean;
}

/* ── Curation ────────────────────────────────────────────────── */

/**
 * How the journalist rates a piece — separate from how it performed.
 * The brief is explicit that these must not be merged: a signature
 * investigation with modest traffic is still the signature investigation.
 */
export type PortfolioClass = "standard" | "signature" | "investigation" | "award-submission";

export interface Collection extends Record_ {
  title: string;
  description: string;
  /** Ordered — the order is the curation. */
  storyIds: string[];
  coverStoryId?: string;
}

/* ── The whole workspace ─────────────────────────────────────── */

export interface Newsroom {
  ideas: Idea[];
  pitches: Pitch[];
  sources: Source[];
  quotes: Quote[];
  interviews: Interview[];
  entities: Entity[];
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  notes: Note[];
  deadlines: Deadline[];
  collections: Collection[];
  /** Per-story curation, keyed by story id. */
  portfolio: Record<string, PortfolioClass>;
  /** House style: preferred term → terms to avoid. */
  styleGuide: { preferred: string; avoid: string[]; why?: string }[];
}

export const EMPTY_NEWSROOM: Newsroom = {
  ideas: [],
  pitches: [],
  sources: [],
  quotes: [],
  interviews: [],
  entities: [],
  evidence: [],
  timeline: [],
  notes: [],
  deadlines: [],
  collections: [],
  portfolio: {},
  styleGuide: [],
};

/** Records whose contents must never appear in a public payload. */
export const PRIVATE_COLLECTIONS = [
  "ideas",
  "pitches",
  "sources",
  "quotes",
  "interviews",
  "entities",
  "evidence",
  "timeline",
  "notes",
  "deadlines",
] as const satisfies readonly (keyof Newsroom)[];
