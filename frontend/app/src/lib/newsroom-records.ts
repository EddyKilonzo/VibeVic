/**
 * The newsroom record surface, and the translation between two vocabularies.
 *
 * The API speaks Prisma's enums — `CONFIDENTIAL`, `AWARD_SUBMISSION`, `HIGH`.
 * The app has always spoken its own — `confidential`, `award-submission`,
 * `high` — and those spellings are baked into the types in `data/newsroom`, the
 * comparisons in every screen, and the `value` of a dozen `<option>` elements.
 * One of the two had to give, and it was not going to be the client: changing
 * the app's vocabulary would mean touching every screen to gain nothing a
 * reader or a journalist would ever see.
 *
 * So the translation happens here, on the server side of the proxy, and the
 * browser never sees a Prisma enum. That is the same decision
 * `/api/newsroom/stories` already made for `status`, generalised rather than
 * repeated once per collection.
 */

/**
 * Which collections the browser may reach through the record proxy.
 *
 * An allowlist rather than a pass-through of whatever segment arrives in the
 * URL. A catch-all proxy behind one cookie check is a catch-all proxy: it would
 * happily forward `/newsroom/sources/:id/protected-identity` the day somebody
 * guessed the path, and the only thing standing between that request and an
 * answer would be a scope check on a server the browser is not talking to.
 * Naming the eleven collections costs a line each and makes the reachable
 * surface something you can read rather than reason about.
 *
 * Media is deliberately absent. It has its own routes because uploading is not
 * a record write — the bytes go to Cloudinary first, and the receipt that comes
 * back is what gets stored.
 */
export const RECORD_COLLECTIONS = [
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
  "collections",
] as const;

export type RecordCollection = (typeof RECORD_COLLECTIONS)[number];

export function isRecordCollection(value: string): value is RecordCollection {
  return (RECORD_COLLECTIONS as readonly string[]).includes(value);
}

/**
 * Field names whose values are enums on both sides.
 *
 * Keyed by name rather than inferred from the value, and that is the honest
 * trade. Transforming every uppercase string in a payload would mangle a
 * source's name, an interviewee, a quote that happens to shout. Only these six
 * fields carry enums anywhere in the newsroom model, the list is short enough
 * to check against `schema.prisma` by eye, and a field added without being
 * listed here fails loudly in the screen that reads it rather than silently
 * corrupting neighbouring text.
 */
const ENUM_FIELDS: ReadonlySet<string> = new Set([
  "visibility",
  "stage",
  "priority",
  "status",
  "kind",
  "class",
]);

/** `AWARD_SUBMISSION` → `award-submission`. */
function enumToApp(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

/** `award-submission` → `AWARD_SUBMISSION`. */
function enumToApi(value: string): string {
  return value.toUpperCase().replace(/-/g, "_");
}

type Json = string | number | boolean | null | undefined | Json[] | { [key: string]: Json };

/**
 * API payload to app payload.
 *
 * Two transforms, both of which exist because the wire format and the declared
 * TypeScript types disagree in ways that are invisible until they are not:
 *
 *  - Enum fields are lowercased, so `idea.stage === "spark"` works.
 *  - `null` becomes `undefined`, because the model spells an absent value
 *    `storyId?: string`. A `null` sitting in an optional field type-checks
 *    nowhere and reaches a screen as the string "null" the moment somebody
 *    renders it without thinking.
 */
export function fromApi(value: Json): Json {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map((item) => fromApi(item));
  if (typeof value !== "object" || value === undefined) return value;

  const out: { [key: string]: Json } = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] =
      ENUM_FIELDS.has(key) && typeof child === "string" ? enumToApp(child) : fromApi(child);
  }
  return out;
}

/**
 * App payload to API payload.
 *
 * `undefined` is dropped rather than sent as null. The distinction matters on a
 * PATCH: the API reads an absent key as "leave this alone" and an explicit null
 * as "clear it", so serialising one as the other would turn every partial
 * update into an unintended erasure of everything it did not mention.
 */
export function toApi(value: Json): Json {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => toApi(item));
  if (typeof value !== "object") return value;

  const out: { [key: string]: Json } = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    out[key] =
      ENUM_FIELDS.has(key) && typeof child === "string" ? enumToApi(child) : toApi(child);
  }
  return out;
}
