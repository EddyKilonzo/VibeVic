import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import type { Block } from "@/data/types";

/**
 * What a story said before.
 *
 * ── Why there is no restore route ────────────────────────────────────────
 * Restoring is not a separate operation. A revision is a headline, a
 * standfirst and a body; putting one back is writing those three fields,
 * which is exactly what the editor's own save already does — through the
 * optimistic lock, so a restore made from a stale tab is refused like any
 * other stale write, and through `snapshot` on the API, so the copy being
 * replaced is itself kept.
 *
 * A dedicated restore endpoint would be a second write path to the same three
 * columns. It would need its own concurrency check and its own snapshot, and
 * the day one of those drifted from the other would be the day a restore
 * quietly destroyed the version it was restoring from.
 *
 * So this route reads, and the client writes what it read.
 */

export const dynamic = "force-dynamic";

/** A revision as the API returns it. */
interface RevisionRow {
  id: string;
  title: string;
  dek: string;
  body: Block[];
  createdAt: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const rows = await newsroomFetch<RevisionRow[]>(
      `/admin/stories/${encodeURIComponent(id)}/revisions`,
    );
    // Field by field rather than spread, matching `story-records.ts`: the
    // admin surface returns whole rows by design, and a spread here would
    // forward every column the table grows next.
    return Response.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        dek: row.dek,
        body: row.body ?? [],
        createdAt: row.createdAt,
      })),
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
