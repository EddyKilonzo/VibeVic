import type { ComponentType } from "react";
import { SendPitch } from "@/components/admin/SendPitch";
import type { ListKey } from "@/data/newsroom/store";
import type { Scope } from "@/lib/newsroom-scopes";

/**
 * What each newsroom record is made of, said once.
 *
 * ── Why a schema and not eight screens ───────────────────────────────────
 * The API has had full CRUD for sources, quotes, interviews, entities,
 * evidence, timeline events, notes and deadlines since the newsroom was
 * built. The admin had screens for none of them: the only place any of it
 * surfaced was a count on the settings page, so a journalist could be told
 * "you have 12 sources" and had no way to open one.
 *
 * Eight bespoke screens is the obvious fix and the wrong one. They would
 * differ in a hundred small ways nobody chose — this one puts visibility at
 * the top, that one at the bottom; this one commits on blur, that one on
 * Enter — and a journalist would have to learn each. Worse, the next
 * collection would be a ninth screen rather than a table entry.
 *
 * So the shape of every record lives here as data, and one panel renders all
 * of them. Adding a field is a line; adding a collection is an entry.
 *
 * ── This describes the form, not the permission ──────────────────────────
 * Nothing here gates anything. Every field is validated again by a DTO on the
 * API and every read is filtered by visibility before it leaves the database.
 * If this file and a DTO disagree, the DTO wins and this file is a form that
 * produces a 400 — which is a bug, but never a hole.
 */

/**
 * Collections this schema covers.
 *
 * Ideas are the one collection left out, and deliberately: `AdminIdeas` is a
 * screen built around what an idea is — stage, priority typed by hand, the
 * desk that works one up — and flattening that into a generic form would lose
 * every part of it that was decided on purpose.
 *
 * Pitches are in, because they never had a screen at all. The desk produced
 * them and nothing could store, edit or send one.
 */
export type RecordKey = Extract<
  ListKey,
  | "pitches"
  | "sources"
  | "quotes"
  | "interviews"
  | "entities"
  | "evidence"
  | "timeline"
  | "notes"
  | "deadlines"
>;

/** A record being edited, before it is anything more specific. */
export type Draft = Record<string, unknown>;

export type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "datetime"
  | "select"
  | "tags"
  | "lines"
  | "toggle"
  | "ref"
  | "refs";

export interface Field {
  name: string;
  label: string;
  kind: FieldKind;
  /** For `select`. */
  options?: readonly { value: string; label: string }[];
  /** For `ref` and `refs`: the collection to pick from. */
  from?: RecordKey;
  /** Shown under the field, quietly. Say why it exists, not what it is. */
  help?: string;
  placeholder?: string;
  /** Spans both columns. Long prose and lists always should. */
  wide?: boolean;
  /** The API refuses a create without it, so the form does too. */
  required?: boolean;
  /** Hidden unless this is true of the draft as it currently stands. */
  when?: (draft: Draft) => boolean;
}

export interface RecordSchema {
  key: RecordKey;
  singular: string;
  plural: string;
  /** One line on what the collection is for, shown when it is empty. */
  blurb: string;
  fields: readonly Field[];
  /**
   * A scope beyond `newsroom:read` that this collection needs.
   *
   * Only pitches have one. Like every other scope check on the client, this
   * decides what to *draw* — the API refuses the request on its own — and the
   * point of drawing it correctly is that a dev opening the records screen
   * should see the collections that are theirs rather than a tab that answers
   * 403 when pressed.
   */
  scope?: Scope;
  /**
   * A control that belongs to this collection and to no other.
   *
   * One field, one user: sending a pitch. It is not a field, it is not an
   * edit, and it is the only thing in the newsroom that leaves the building —
   * so it could not be described by the schema and did not deserve a second
   * panel. Anything that turns out to want a second one of these is probably
   * asking for its own screen.
   */
  extra?: ComponentType<{ record: Draft }>;
  /** A new record, with the same defaults the API would apply. */
  blank: () => Draft;
  /** The line that identifies a row in the list. */
  title: (draft: Draft) => string;
  /** The quieter second line, when there is something worth saying. */
  subtitle?: (draft: Draft) => string;
  /**
   * How a record attaches to a story: a list of ids, a single id, or not at
   * all. Entities are the only `null` — a person or an organisation is not
   * "about" one piece, which is exactly why the terminology check can read
   * them across the whole newsroom.
   */
  storyLink: "many" | "one" | null;
}

/* ── Shared option lists ─────────────────────────────────────── */

const VISIBILITY = [
  { value: "confidential", label: "Confidential — even its existence is protected" },
  { value: "private", label: "Private — the newsroom only" },
  { value: "publishable", label: "Publishable — cleared to appear in a piece" },
] as const;

const SOURCE_STATUS = [
  { value: "unverified", label: "Unverified" },
  { value: "verifying", label: "Verifying" },
  { value: "verified", label: "Verified" },
  { value: "disputed", label: "Disputed" },
] as const;

const ENTITY_KIND = [
  { value: "person", label: "Person" },
  { value: "organisation", label: "Organisation" },
  { value: "location", label: "Location" },
  { value: "project", label: "Project" },
  { value: "document", label: "Document" },
] as const;

/** The visibility field, identical everywhere it appears. */
const visibility = (dflt: string): Field => ({
  name: "visibility",
  label: "Visibility",
  kind: "select",
  options: VISIBILITY,
  help:
    dflt === "confidential"
      ? "Confidential by default. A record whose tier was forgotten is one nobody cleared."
      : undefined,
});

/** A string off a draft, for the title and subtitle functions. */
const str = (draft: Draft, key: string): string =>
  typeof draft[key] === "string" ? (draft[key] as string) : "";

/** A date a person can read, or nothing at all rather than a guess. */
function readableDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/* ── The eight ───────────────────────────────────────────────── */

export const RECORD_SCHEMAS: Readonly<Record<RecordKey, RecordSchema>> = {
  pitches: {
    key: "pitches",
    singular: "pitch",
    plural: "Pitches",
    blurb:
      "An idea worked up far enough to put to an editor. The angle is the specific claim, not the subject area — a pitch without one is a subject.",
    storyLink: "one",
    scope: "newsroom:ideas",
    extra: SendPitch,
    title: (d) => str(d, "title") || "Untitled pitch",
    subtitle: (d) =>
      [str(d, "targetPublication"), readableDate(d.deadline)].filter(Boolean).join(" · ") ||
      str(d, "angle"),
    blank: () => ({
      title: "",
      angle: "",
      whyItMatters: "",
      whatIsKnown: "",
      whatIsUnknown: "",
      targetPublication: "",
      deadline: "",
      sourceIds: [],
    }),
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      {
        name: "targetPublication",
        label: "Where you would send it",
        kind: "text",
        help: "A masthead, not an address. The address is typed when you send, and shown to you first.",
      },
      {
        name: "angle",
        label: "The angle",
        kind: "textarea",
        wide: true,
        required: true,
        help: "The specific claim being made, not the subject area.",
      },
      { name: "whyItMatters", label: "Why it matters", kind: "textarea", wide: true },
      { name: "whatIsKnown", label: "What is known", kind: "textarea", wide: true },
      {
        name: "whatIsUnknown",
        label: "What is still open",
        kind: "textarea",
        wide: true,
        help: "An empty answer here is a pitch that is not ready.",
      },
      { name: "deadline", label: "Filing by", kind: "date" },
      {
        name: "sourceIds",
        label: "Sources lined up",
        kind: "refs",
        from: "sources",
        wide: true,
        help:
          "References, never copies. A sent pitch carries the count and not the people — an email is a poor place to be responsible for a source.",
      },
    ],
  },

  sources: {
    key: "sources",
    singular: "source",
    plural: "Sources",
    blurb:
      "Who told you. A source may be a pseudonym; the real name lives in its own field and is only ever shown to a writer.",
    storyLink: "many",
    title: (d) => str(d, "name") || "Unnamed source",
    subtitle: (d) => [str(d, "role"), str(d, "organisation")].filter(Boolean).join(" · "),
    blank: () => ({
      name: "",
      role: "",
      organisation: "",
      url: "",
      accessedAt: "",
      notes: "",
      status: "unverified",
      visibility: "confidential",
      protectedIdentity: "",
      storyIds: [],
    }),
    fields: [
      { name: "name", label: "Name or pseudonym", kind: "text", required: true },
      { name: "role", label: "Role", kind: "text", placeholder: "What they do" },
      { name: "organisation", label: "Organisation", kind: "text" },
      { name: "status", label: "Verification", kind: "select", options: SOURCE_STATUS },
      visibility("confidential"),
      {
        name: "url",
        label: "Link",
        kind: "text",
        placeholder: "https://",
        help: "A full address. The API validates it, so a half-typed one is refused rather than stored.",
      },
      {
        name: "accessedAt",
        label: "Last opened",
        kind: "date",
        help: "The day you actually opened that link — never defaulted to today.",
      },
      {
        name: "protectedIdentity",
        label: "Real identity",
        kind: "text",
        wide: true,
        when: (d) => d.visibility === "confidential",
        help:
          "The name behind the pseudonym. Never returned by an ordinary read, and never shown to the dev account.",
      },
      { name: "notes", label: "Notes", kind: "textarea", wide: true },
    ],
  },

  quotes: {
    key: "quotes",
    singular: "quote",
    plural: "Quotes",
    blurb: "The words themselves, with who said them and when — which is not when you wrote them down.",
    storyLink: "many",
    title: (d) => str(d, "text") || "Empty quote",
    subtitle: (d) =>
      [str(d, "speaker"), str(d, "speakerRole"), readableDate(d.saidAt)].filter(Boolean).join(" · "),
    blank: () => ({
      text: "",
      speaker: "",
      speakerRole: "",
      saidAt: "",
      sourceId: "",
      interviewId: "",
      status: "unverified",
      visibility: "private",
      storyIds: [],
    }),
    fields: [
      { name: "text", label: "What was said", kind: "textarea", wide: true, required: true },
      { name: "speaker", label: "Speaker", kind: "text", required: true },
      { name: "speakerRole", label: "Their role", kind: "text" },
      {
        name: "saidAt",
        label: "Said on",
        kind: "date",
        help: "When it was said. Not when it was written down — the two drift apart constantly.",
      },
      { name: "status", label: "Verification", kind: "select", options: SOURCE_STATUS },
      {
        name: "sourceId",
        label: "Source",
        kind: "ref",
        from: "sources",
        help:
          "Attribution. A quote can be private while its source is confidential — the words are repeatable, the identity is not.",
      },
      { name: "interviewId", label: "From interview", kind: "ref", from: "interviews" },
      visibility("private"),
    ],
  },

  interviews: {
    key: "interviews",
    singular: "interview",
    plural: "Interviews",
    blurb: "Who you spoke to, what you were trying to find out, and what is still unanswered.",
    storyLink: "many",
    title: (d) => str(d, "interviewee") || "Unnamed interview",
    subtitle: (d) => [str(d, "role"), readableDate(d.conductedAt)].filter(Boolean).join(" · "),
    blank: () => ({
      interviewee: "",
      role: "",
      purpose: "",
      conductedAt: "",
      notes: "",
      followUps: [],
      visibility: "confidential",
      storyIds: [],
    }),
    fields: [
      { name: "interviewee", label: "Interviewee", kind: "text", required: true },
      { name: "role", label: "Their role", kind: "text" },
      { name: "conductedAt", label: "Conducted on", kind: "date" },
      visibility("confidential"),
      {
        name: "purpose",
        label: "What you were after",
        kind: "textarea",
        wide: true,
        help: "Written before, ideally. It is what tells you afterwards whether you got it.",
      },
      {
        name: "notes",
        label: "Notes",
        kind: "textarea",
        wide: true,
        help: "Transcripts live here too, if a recording is ever made.",
      },
      {
        name: "followUps",
        label: "Still to ask",
        kind: "lines",
        wide: true,
        help: "One question per line. The list that makes a second call worth making.",
      },
    ],
  },

  entities: {
    key: "entities",
    singular: "entity",
    plural: "Entities",
    blurb:
      "People, organisations, places and documents the reporting keeps returning to. The aliases feed the terminology check on every draft.",
    storyLink: null,
    title: (d) => str(d, "name") || "Unnamed",
    subtitle: (d) => {
      const kind = ENTITY_KIND.find((k) => k.value === d.kind)?.label ?? "";
      const aliases = Array.isArray(d.aliases) ? d.aliases.length : 0;
      return [kind, aliases ? `${aliases} alias${aliases === 1 ? "" : "es"}` : ""]
        .filter(Boolean)
        .join(" · ");
    },
    blank: () => ({
      kind: "person",
      name: "",
      aliases: [],
      note: "",
      visibility: "private",
    }),
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "kind", label: "Kind", kind: "select", options: ENTITY_KIND },
      visibility("private"),
      {
        name: "aliases",
        label: "Other spellings",
        kind: "tags",
        wide: true,
        help:
          "Acronyms and variants seen in the copy. The pre-publication check reads these to spot a name spelled two ways in one piece.",
      },
      { name: "note", label: "Note", kind: "textarea", wide: true },
    ],
  },

  evidence: {
    key: "evidence",
    singular: "piece of evidence",
    plural: "Evidence",
    blurb: "A document, a figure, a recording — and, in its own field, the claim it actually supports.",
    storyLink: "many",
    title: (d) => str(d, "title") || "Untitled",
    subtitle: (d) => str(d, "supports"),
    blank: () => ({
      title: "",
      supports: "",
      sourceId: "",
      entityIds: [],
      reference: "",
      visibility: "private",
      storyIds: [],
    }),
    fields: [
      { name: "title", label: "What it is", kind: "text", required: true },
      visibility("private"),
      {
        name: "supports",
        label: "What it demonstrates",
        kind: "textarea",
        wide: true,
        help:
          "The claim this backs, written out. Evidence filed without it is a document nobody can use six months later.",
      },
      {
        name: "reference",
        label: "Where it is",
        kind: "text",
        wide: true,
        help:
          "A link or a filing reference. There is no upload pipeline here, and a fake one would imply the document is stored when it is not.",
      },
      { name: "sourceId", label: "Came from", kind: "ref", from: "sources" },
      { name: "entityIds", label: "Concerns", kind: "refs", from: "entities", wide: true },
    ],
  },

  timeline: {
    key: "timeline",
    singular: "event",
    plural: "Timeline",
    blurb: "What happened, and when it happened — which is the one job a timeline has.",
    storyLink: "many",
    title: (d) => str(d, "what") || "Untitled event",
    subtitle: (d) => readableDate(d.occurredAt),
    blank: () => ({
      occurredAt: "",
      what: "",
      entityIds: [],
      evidenceIds: [],
      storyIds: [],
    }),
    fields: [
      {
        name: "occurredAt",
        label: "Date it happened",
        kind: "date",
        required: true,
        help:
          "The date of the event, never the date you learned of it. A document surfacing in March about a meeting last August is an August event.",
      },
      { name: "what", label: "What happened", kind: "textarea", wide: true, required: true },
      { name: "entityIds", label: "Who was involved", kind: "refs", from: "entities", wide: true },
      { name: "evidenceIds", label: "Backed by", kind: "refs", from: "evidence", wide: true },
    ],
  },

  notes: {
    key: "notes",
    singular: "note",
    plural: "Notes",
    blurb: "Thinking out loud. Yours, about the piece — which is why these start private rather than confidential.",
    storyLink: "one",
    title: (d) => str(d, "title") || "Untitled note",
    subtitle: (d) => str(d, "body").slice(0, 120),
    blank: () => ({ title: "", body: "", visibility: "private" }),
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, wide: true },
      visibility("private"),
      { name: "body", label: "Note", kind: "textarea", wide: true },
    ],
  },

  deadlines: {
    key: "deadlines",
    singular: "deadline",
    plural: "Deadlines",
    blurb: "What is due, and when. A time of day as well as a date, because “Friday” and “Friday 6pm” are different promises.",
    storyLink: "one",
    title: (d) => str(d, "label") || "Untitled",
    subtitle: (d) => {
      if (typeof d.dueAt !== "string" || !d.dueAt) return "";
      const at = new Date(d.dueAt);
      if (Number.isNaN(at.getTime())) return "";
      return at.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    blank: () => ({ label: "", dueAt: "", done: false }),
    fields: [
      { name: "label", label: "What is due", kind: "text", required: true, wide: true },
      { name: "dueAt", label: "Due", kind: "datetime", required: true },
      { name: "done", label: "Done", kind: "toggle" },
    ],
  },
};

/** The order the tabs and the records screen use. */
export const RECORD_ORDER: readonly RecordKey[] = [
  "pitches",
  "sources",
  "quotes",
  "interviews",
  "evidence",
  "timeline",
  "entities",
  "notes",
  "deadlines",
];

/** Those a story can own, in the order the workspace shows them. */
export const STORY_RECORD_ORDER: readonly RecordKey[] = RECORD_ORDER.filter(
  (key) => RECORD_SCHEMAS[key].storyLink !== null,
);

/**
 * The collections a panel has to load to render itself: its own, plus every
 * collection its `ref` and `refs` fields choose from.
 *
 * Computed rather than listed, because the day somebody adds a reference field
 * is the day a hand-written list silently stops loading what the picker needs
 * — and the symptom is an empty dropdown, which reads as "there are none".
 */
export function collectionsNeededBy(key: RecordKey): RecordKey[] {
  const referenced = RECORD_SCHEMAS[key].fields
    .map((field) => field.from)
    .filter((from): from is RecordKey => Boolean(from));
  return [...new Set<RecordKey>([key, ...referenced])];
}
