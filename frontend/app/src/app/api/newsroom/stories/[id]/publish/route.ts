import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { toStory, type AdminStoryRow } from "@/lib/story-records";

/**
 * Putting a story on the site.
 *
 * ── Why this route exists while the thing it calls does not work ─────────
 * `StoriesService.publish` throws `NotImplementedException`, on an argument
 * worth repeating: publishing is not a status column write. It needs the
 * scheduled-transition job, a canonical URL check, and a decision about what
 * happens to a piece that was public and is being pulled.
 *
 * The editor could satisfy `publishedWhere` on its own — `status: "PUBLISHED"`
 * plus a `publishedAt` in the past is the whole condition — and that is exactly
 * why it must not. `story-records.ts` keeps `status` out of every write for
 * that reason, and this is where the transition goes instead: one route, which
 * asks the server whose job it is and relays what it says.
 *
 * Today what it says is 501 and a sentence naming what is missing. That is a
 * better thing for a writer to read than a button that quietly did nothing, and
 * it is the same route that will work unchanged on the day the API implements
 * the other two thirds.
 */

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const published = await newsroomFetch<AdminStoryRow>(
      `/admin/stories/${encodeURIComponent(id)}/publish`,
      { method: "POST" },
    );
    return Response.json(toStory(published));
  } catch (cause) {
    return errorResponse(cause);
  }
}
