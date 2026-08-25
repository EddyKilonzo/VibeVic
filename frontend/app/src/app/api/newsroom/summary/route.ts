import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * How many records the newsroom holds.
 *
 * No enum translation and no shaping: the body is a map of collection names to
 * integers, and both sides already spell those names the same way. The counting
 * happens in Postgres and respects the confidential tier, so this route
 * forwards numbers that were already safe to know.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  try {
    return Response.json(await newsroomFetch<Record<string, number>>("/newsroom/summary"));
  } catch (cause) {
    return errorResponse(cause);
  }
}
