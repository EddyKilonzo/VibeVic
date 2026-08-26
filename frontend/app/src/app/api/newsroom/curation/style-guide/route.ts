import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import type { Newsroom } from "@/data/newsroom/types";

/**
 * The house style guide: preferred wording, what to avoid, and why.
 *
 * ── Read and replaced whole, never entry by entry ────────────────────────
 * The API offers no per-entry route, deliberately — `SetStyleGuideDto` says a
 * guide is edited in one sitting and saved once, and five requests that can
 * half-fail are a worse model of that than one that cannot. This proxy keeps
 * that shape rather than papering a per-row API over it, because a screen that
 * could save half a style guide would eventually save half a style guide.
 *
 * The consequence worth knowing: PUT is the entire document. Sending an empty
 * array empties it, which is why the handler refuses a body that is not an
 * array rather than treating a malformed one as "no entries".
 */

export const dynamic = "force-dynamic";

type Entry = Newsroom["styleGuide"][number];

const LOCKED = { error: "The newsroom is locked." } as const;

/** A row as the API returns it, with the columns the app does not model. */
interface StyleGuideRow {
  preferred: string;
  avoid: string[];
  why: string | null;
}

function toApp(row: StyleGuideRow): Entry {
  // `why` is optional in the app's model, and a null in an optional field
  // reaches a screen as the string "null" the first time somebody renders it
  // without thinking. Same conversion `newsroom-records.ts` makes, same reason.
  return { preferred: row.preferred, avoid: row.avoid ?? [], why: row.why ?? undefined };
}

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  try {
    const rows = await newsroomFetch<StyleGuideRow[]>("/newsroom/style-guide");
    return Response.json(rows.map(toApp));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  let entries: unknown;
  try {
    entries = (await request.json()) as unknown;
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  if (!Array.isArray(entries)) {
    // Not treated as "no entries". A PUT here replaces the document, so reading
    // an unparseable body as empty would delete the guide on a malformed
    // request — the one outcome nobody could have intended.
    return Response.json({ error: "A style guide is a list of entries." }, { status: 400 });
  }

  const clean = entries
    .filter((entry): entry is Entry => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      preferred: String(entry.preferred ?? "").trim(),
      avoid: Array.isArray(entry.avoid) ? entry.avoid.filter((a) => typeof a === "string") : [],
      why: entry.why?.trim() || undefined,
    }))
    // An entry with no preferred spelling is not an entry; the API's
    // `@MinLength(1)` would reject the whole document over one blank row, which
    // is a bad trade when the row carries nothing.
    .filter((entry) => entry.preferred.length > 0);

  try {
    const saved = await newsroomFetch<StyleGuideRow[]>("/newsroom/style-guide", {
      method: "PUT",
      body: JSON.stringify({ entries: clean }),
    });
    return Response.json(saved.map(toApp));
  } catch (cause) {
    return errorResponse(cause);
  }
}
