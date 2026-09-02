import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * Days the newsroom was opened, and the streak they make.
 *
 * ── Why the browser never names an account ───────────────────────────────
 * Neither verb takes one. The API reads the id off the verified principal, so
 * there is no shape of request that asks about somebody else — which is a
 * stronger guarantee than a scope check, because a scope can be granted and
 * this cannot. This route forwards two calls with no parameters, which is
 * exactly as much surface as that needs.
 */

export const dynamic = "force-dynamic";

interface Streak {
  current: number;
  longest: number;
  activeToday: boolean;
  lastActiveOn: string | null;
  days: string[];
}

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  try {
    return Response.json(await newsroomFetch<Streak>("/newsroom/activity"));
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * "I am here today."
 *
 * Idempotent on the API — the row is keyed by (account, day) — so the shell
 * calls it on every mount without having to remember whether it already has.
 */
export async function POST(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  try {
    return Response.json(
      await newsroomFetch<{ day: string }>("/newsroom/activity", { method: "POST" }),
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
