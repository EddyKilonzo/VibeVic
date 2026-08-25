import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { fromApi, isRecordCollection, toApi } from "@/lib/newsroom-records";

/**
 * Listing and creating newsroom records, for every collection that has one.
 *
 * One handler rather than eleven near-identical files. The thing that made
 * eleven files tempting — each collection having its own shape — turns out not
 * to be this layer's business: the proxy holds a credential, checks a cookie
 * and translates two enum vocabularies, none of which varies by collection. The
 * shapes are validated by DTOs on the API, which is the only place that can
 * validate them properly anyway.
 *
 * What does not get generalised is *which* collections are reachable. That is
 * an allowlist in `newsroom-records.ts`, and an unknown segment is a 404 here
 * rather than a request forwarded to see what the API makes of it.
 *
 * ── Two locks, as everywhere under /api/newsroom ─────────────────────────
 * The middleware matcher covers this path, and `isUnlocked` checks again. A
 * matcher is configuration and a route can be moved; the cost of getting either
 * wrong is an open window onto unpublished work, so neither is trusted alone.
 */

export const dynamic = "force-dynamic";

type Json = Parameters<typeof toApi>[0];

const LOCKED = { error: "The newsroom is locked." } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collection: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const { collection } = await params;
  if (!isRecordCollection(collection)) {
    return Response.json({ error: "No such newsroom collection." }, { status: 404 });
  }

  try {
    const rows = await newsroomFetch<Json>(`/newsroom/${collection}`);
    return Response.json(fromApi(rows));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collection: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  const { collection } = await params;
  if (!isRecordCollection(collection)) {
    return Response.json({ error: "No such newsroom collection." }, { status: 404 });
  }

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    const created = await newsroomFetch<Json>(`/newsroom/${collection}`, {
      method: "POST",
      body: JSON.stringify(toApi(body)),
    });
    return Response.json(fromApi(created), { status: 201 });
  } catch (cause) {
    return errorResponse(cause);
  }
}
