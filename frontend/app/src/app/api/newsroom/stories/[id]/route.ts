import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { toApiUpdate, toStory, type AdminStoryRow } from "@/lib/story-records";
import type { Story } from "@/data/types";

/**
 * Reading and editing one story, drafts included.
 *
 * ── The 409 travels through untouched ────────────────────────────────────
 * Every PATCH carries the `updatedAt` the editor last saw, and the API answers
 * 409 when the row has moved on since. A proxy that swallowed that and retried
 * would turn "your edit was not applied, here is why" into a silent overwrite
 * of whatever the other tab wrote — which is precisely the failure the
 * conditional UPDATE exists to prevent. It comes back to the browser as a 409
 * and the workspace decides what to say about it.
 */

export const dynamic = "force-dynamic";

const LOCKED = { error: "The newsroom is locked." } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const { id } = await params;

  try {
    const row = await newsroomFetch<AdminStoryRow>(
      `/admin/stories/${encodeURIComponent(id)}`,
    );
    return Response.json(toStory(row));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const { id } = await params;

  let payload: { story?: Story; expectedUpdatedAt?: string };
  try {
    payload = (await request.json()) as { story?: Story; expectedUpdatedAt?: string };
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  const { story, expectedUpdatedAt } = payload;
  if (!story || typeof story !== "object") {
    return Response.json({ error: "That request carried no story." }, { status: 400 });
  }

  /**
   * No timestamp, no write.
   *
   * The API has no opt-out of the concurrency check and this route does not
   * invent one. A fabricated or omitted timestamp would either be rejected
   * anyway or — far worse — happen to match and overwrite an edit nobody has
   * seen. Refusing is the honest answer, and the editor knows how to ask again
   * once it has re-read the record.
   */
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) {
    return Response.json(
      { error: "This copy has no version to check against, so it was not sent. Reload the piece." },
      { status: 409 },
    );
  }

  try {
    const updated = await newsroomFetch<AdminStoryRow>(
      `/admin/stories/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(toApiUpdate(story, expectedUpdatedAt)) },
    );
    return Response.json(toStory(updated));
  } catch (cause) {
    return errorResponse(cause);
  }
}
