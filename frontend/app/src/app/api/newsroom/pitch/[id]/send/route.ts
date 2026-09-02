import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * Sends a pitch to an editor.
 *
 * ── Why this is not part of the record proxy ─────────────────────────────
 * `/api/newsroom/records/[collection]` forwards creates, updates and deletes
 * for the eleven collections, and the allowlist there exists precisely so a
 * path cannot be guessed into something the proxy was never meant to reach.
 * Sending is not a record write: it leaves the building, it cannot be undone,
 * and it takes an argument — an address — that appears nowhere in the record.
 * Folding it into a catch-all would make the one irreversible operation in the
 * newsroom reachable by the same route shape as a typo fix.
 *
 * ── The address is forwarded, never derived ──────────────────────────────
 * `Pitch.targetPublication` holds a masthead, which is a note to self rather
 * than a mailbox. This route does not guess at one, and the API validates what
 * arrives with `@IsEmail`. The screen shows the writer the address before they
 * press send, because the failure mode of getting this wrong is not an error —
 * it is a pitch quietly arriving somewhere else.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const sent = await newsroomFetch<{ deliveredTo: string; accepted: boolean }>(
      `/newsroom/pitches/${encodeURIComponent(id)}/send`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return Response.json(sent);
  } catch (cause) {
    return errorResponse(cause);
  }
}
