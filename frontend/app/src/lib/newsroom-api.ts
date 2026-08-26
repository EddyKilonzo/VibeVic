import "server-only";

/**
 * Calling the newsroom API from a Next route handler.
 *
 * Every newsroom proxy needs the same four things — the base URL, the bearer
 * token, a timeout, and a way to turn a failure into a sentence a journalist
 * can act on. Written once here rather than four times, because the copy that
 * gets forgotten is the one without the timeout.
 *
 * This module never decides authorisation. Callers are behind the middleware
 * matcher and check `isUnlocked()` themselves; a helper that both held the
 * credential and judged who may use it would be a helper somebody calls from
 * the wrong place believing they are safe.
 */

const BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

export class NewsroomApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NewsroomApiError";
  }
}

/**
 * Performs the call and returns the parsed body.
 *
 * Throws `NewsroomApiError` with a status the caller can pass straight back.
 * The distinction that matters: 501 means the credential was never configured,
 * 502 means the API could not be reached or refused us — one is a settings
 * problem and the other is an outage, and they send someone to different files.
 */
export async function newsroomFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = process.env.NEWSROOM_API_TOKEN;
  if (!token) {
    console.error(`[newsroom-api] NEWSROOM_API_TOKEN is not set; ${path} not attempted.`);
    throw new NewsroomApiError(
      "NEWSROOM_API_TOKEN is not configured, so the newsroom API cannot be reached.",
      501,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    console.error(`[newsroom-api] ${init.method ?? "GET"} ${path} failed:`, cause);
    throw new NewsroomApiError("The API could not be reached. Nothing was changed.", 502);
  }

  if (!response.ok) {
    // The API's own message is worth forwarding for a 4xx — it is written for a
    // person and says which field was wrong. A 5xx message is not: it describes
    // the server's internals, so it stays in the log.
    const detail = await messageFrom(response);
    console.error(`[newsroom-api] ${init.method ?? "GET"} ${path} -> ${response.status}`);

    if (response.status === 401 || response.status === 403) {
      throw new NewsroomApiError(
        "The API rejected the newsroom credential. Check NEWSROOM_API_TOKEN.",
        502,
      );
    }
    if (response.status >= 400 && response.status < 500) {
      throw new NewsroomApiError(detail ?? "The API refused that request.", response.status);
    }

    /**
     * 501 is forwarded whole, message and all.
     *
     * It is the one 5xx that is not about the server's internals. The API uses
     * it deliberately — publishing transitions, token issuance, view counters —
     * to say "this is not built", and the sentence it sends names what is
     * missing. Flattening that to a generic 502 turns a clear answer into an
     * apparent outage, and sends whoever reads it looking for a bug in a
     * feature nobody has written yet.
     */
    if (response.status === 501) {
      throw new NewsroomApiError(
        detail ?? "The API has not implemented that yet.",
        501,
      );
    }

    throw new NewsroomApiError("The API could not complete that request.", 502);
  }

  // 204 and friends have no body; asking for JSON would throw on empty text.
  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch (cause) {
    console.error(`[newsroom-api] unreadable body from ${path}:`, cause);
    throw new NewsroomApiError("The API's answer could not be read.", 502);
  }
}

async function messageFrom(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) {
        return message.filter((m): m is string => typeof m === "string").join("; ");
      }
    }
  } catch {
    // A non-JSON error body is ordinary. The status still carries the meaning.
  }
  return null;
}

/** Turns a thrown error into the Response a route handler should return. */
export function errorResponse(cause: unknown): Response {
  if (cause instanceof NewsroomApiError) {
    return Response.json({ error: cause.message }, { status: cause.status });
  }
  console.error("[newsroom-api] unexpected:", cause);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
