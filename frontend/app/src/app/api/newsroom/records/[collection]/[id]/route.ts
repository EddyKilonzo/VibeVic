import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { fromApi, isRecordCollection, toApi } from "@/lib/newsroom-records";

/**
 * Reading, editing and deleting one newsroom record.
 *
 * The PATCH here carries `expectedUpdatedAt` through to the API untouched, and
 * a 409 comes back to the browser as a 409. That pass-through is the whole
 * point of the concurrency mechanism reaching this far: a proxy that swallowed
 * the conflict and retried, or flattened it to a generic 500, would turn "your
 * edit was not applied, here is why" into "something went wrong" — and the
 * screen would have nothing true to tell the journalist.
 */

export const dynamic = "force-dynamic";

type Json = Parameters<typeof toApi>[0];

const LOCKED = { error: "The newsroom is locked." } as const;

/** Resolves and validates the two path segments, or explains why it cannot. */
async function target(
  params: Promise<{ collection: string; id: string }>,
): Promise<{ path: string } | { error: Response }> {
  const { collection, id } = await params;
  if (!isRecordCollection(collection)) {
    return {
      error: Response.json({ error: "No such newsroom collection." }, { status: 404 }),
    };
  }
  return { path: `/newsroom/${collection}/${encodeURIComponent(id)}` };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const resolved = await target(params);
  if ("error" in resolved) return resolved.error;

  try {
    return Response.json(fromApi(await newsroomFetch<Json>(resolved.path)));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const resolved = await target(params);
  if ("error" in resolved) return resolved.error;

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    const updated = await newsroomFetch<Json>(resolved.path, {
      method: "PATCH",
      body: JSON.stringify(toApi(body)),
    });
    return Response.json(fromApi(updated));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const resolved = await target(params);
  if ("error" in resolved) return resolved.error;

  try {
    return Response.json(fromApi(await newsroomFetch<Json>(resolved.path, { method: "DELETE" })));
  } catch (cause) {
    return errorResponse(cause);
  }
}
