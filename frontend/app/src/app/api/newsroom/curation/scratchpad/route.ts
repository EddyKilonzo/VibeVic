import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * The scratchpad: one document, shared by every screen that shows it.
 *
 * ── Why it is not a note ─────────────────────────────────────────────────
 * The newsroom already has notes, and they are records: titled, attached to a
 * piece, carrying a visibility, filed on purpose. This is the place thinking
 * goes *before* it is worth filing. Giving it a title field would reintroduce
 * the ceremony it exists to avoid, and a scratchpad you have to name is a
 * scratchpad you use once.
 *
 * ── One pad, read and replaced whole ─────────────────────────────────────
 * The same shape as the style guide next door, for a smaller reason: there is
 * only one document, so there is nothing to address. PUT carries the entire
 * text and the API upserts a single row, which makes saving idempotent — and
 * that matters more here than anywhere else in the app, because this route is
 * called by an autosave that will retry on a flaky connection.
 *
 * ── An empty body is a value, not a failure ──────────────────────────────
 * Clearing the pad is something a person does deliberately, so `""` has to be
 * legal. That is why this handler checks the *type* of `body` and refuses
 * anything that is not a string, rather than refusing anything falsy: the two
 * look alike and only one of them lets somebody empty their own pad.
 */

export const dynamic = "force-dynamic";

const LOCKED = { error: "The newsroom is locked." } as const;

interface ScratchpadRow {
  body: string;
  updatedAt: string;
}

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  try {
    const row = await newsroomFetch<ScratchpadRow>("/newsroom/scratchpad");
    return Response.json({ body: row.body ?? "", updatedAt: row.updatedAt });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  let payload: unknown;
  try {
    payload = (await request.json()) as unknown;
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  const body =
    typeof payload === "object" && payload !== null
      ? (payload as { body?: unknown }).body
      : undefined;

  if (typeof body !== "string") {
    // Not coerced to "". A PUT replaces the whole pad, so reading a malformed
    // request as an empty one would wipe somebody's thinking on a dropped
    // keystroke — the same argument the style guide makes about arrays.
    return Response.json({ error: "A scratchpad is a piece of text." }, { status: 400 });
  }

  try {
    const saved = await newsroomFetch<ScratchpadRow>("/newsroom/scratchpad", {
      method: "PUT",
      body: JSON.stringify({ body }),
    });
    return Response.json({ body: saved.body ?? "", updatedAt: saved.updatedAt });
  } catch (cause) {
    return errorResponse(cause);
  }
}
