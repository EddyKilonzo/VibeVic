import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { isCatalogKind } from "@/lib/newsroom-catalog";

/**
 * Editing and removing one catalog entry.
 *
 * The `key` segment is a cuid for an award and a slug for a beat. The proxy
 * does not need to care which — the API's route takes one path segment either
 * way — but the difference is why `CATALOG_KEY` exists for the callers, who do.
 *
 * ── The conflicts that come back ─────────────────────────────────────────
 * Two, and both are forwarded whole rather than flattened:
 *
 *   409 on PATCH   The entry changed after it was loaded. The same optimistic
 *                  check every other write in this app carries.
 *
 *   409 on DELETE  A beat with stories filed under it or subjects beneath it.
 *                  The API's message names how many of each, and that sentence
 *                  is the entire value of the refusal — "could not delete"
 *                  would leave the journalist with no idea what to move first.
 */

export const dynamic = "force-dynamic";

const LOCKED = { error: "The newsroom is locked." } as const;

/** Resolves and validates the two path segments, or explains why it cannot. */
async function target(
  params: Promise<{ kind: string; key: string }>,
): Promise<{ path: string } | { error: Response }> {
  const { kind, key } = await params;
  if (!isCatalogKind(kind)) {
    return { error: Response.json({ error: "No such catalog." }, { status: 404 }) };
  }
  return { path: `/newsroom/${kind}/${encodeURIComponent(key)}` };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; key: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const resolved = await target(params);
  if ("error" in resolved) return resolved.error;

  try {
    return Response.json(await newsroomFetch(resolved.path));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ kind: string; key: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const resolved = await target(params);
  if ("error" in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    return Response.json(
      await newsroomFetch(resolved.path, { method: "PATCH", body: JSON.stringify(body) }),
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ kind: string; key: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const resolved = await target(params);
  if ("error" in resolved) return resolved.error;

  try {
    return Response.json(await newsroomFetch(resolved.path, { method: "DELETE" }));
  } catch (cause) {
    return errorResponse(cause);
  }
}
