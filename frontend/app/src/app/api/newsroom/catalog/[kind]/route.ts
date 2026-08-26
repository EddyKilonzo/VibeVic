import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { isCatalogKind } from "@/lib/newsroom-catalog";

/**
 * Listing and creating catalog entries — awards and beats.
 *
 * One handler for both, on the same argument the records proxy makes: holding a
 * credential and checking a cookie does not vary by kind, and the shapes are
 * validated by DTOs on the API, which is the only place that can validate them
 * properly. What does not get generalised is which kinds are reachable.
 *
 * No enum translation here, unlike `records`. Neither table has an enum column:
 * an award's `result` is a plain string constrained to four values by the API,
 * and a beat has none at all. Running the record proxy's `fromApi` over these
 * would lowercase "Winner" into "winner" and quietly corrupt a credential.
 *
 * ── Two locks, as everywhere under /api/newsroom ─────────────────────────
 * The middleware matcher covers this path and `isUnlocked` checks again. A
 * matcher is configuration and a route can be moved; neither is trusted alone.
 */

export const dynamic = "force-dynamic";

const LOCKED = { error: "The newsroom is locked." } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const { kind } = await params;
  if (!isCatalogKind(kind)) {
    return Response.json({ error: "No such catalog." }, { status: 404 });
  }

  try {
    return Response.json(await newsroomFetch(`/newsroom/${kind}`));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const { kind } = await params;
  if (!isCatalogKind(kind)) {
    return Response.json({ error: "No such catalog." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    const created = await newsroomFetch(`/newsroom/${kind}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return Response.json(created, { status: 201 });
  } catch (cause) {
    // A 409 travels through untouched. Creating a beat whose slug is taken is
    // the collision that matters — two beats sharing one would make every story
    // filed under it ambiguous — and the API's message names the slug.
    return errorResponse(cause);
  }
}
