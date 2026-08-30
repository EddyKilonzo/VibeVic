import "server-only";

import { sessionToken } from "./newsroom-auth";

/**
 * Calling the newsroom API from a Next route handler.
 *
 * Every newsroom proxy needs the same four things — the base URL, the bearer
 * token, a timeout, and a way to turn a failure into a sentence a journalist
 * can act on. Written once here rather than four times, because the copy that
 * gets forgotten is the one without the timeout.
 *
 * ── Whose credential this sends ──────────────────────────────────────────
 * The signed-in person's, taken from their own session cookie. It used to be
 * `NEWSROOM_API_TOKEN`: one shared key, held by the server, identical for
 * every caller. That key is gone, and its absence is the point of the whole
 * accounts change — while it existed, the API could not tell a writer from a
 * developer no matter what roles the database held, because every request
 * arrived wearing the same badge. Forwarding the caller's token is what makes
 * `newsroom:confidential` mean anything from a browser.
 *
 * It also means this proxy cannot do more than the person using it. A bug in
 * a route handler is now bounded by the role of whoever triggered it, rather
 * than by the most privileged credential on the server.
 *
 * This module still never decides authorisation. It reads a token and passes
 * it on; the API decides what that token may do. A helper that both held a
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
 * Three distinctions worth keeping apart: 401 means nobody is signed in, 501
 * means the API says a feature is not built, and 502 means the API could not
 * be reached or refused us. They send whoever reads them to three different
 * places — the sign-in page, a roadmap, and a status page.
 */
export async function newsroomFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await sessionToken();
  if (!token) {
    /*
     * 401, where this used to answer 501.
     *
     * The old code was reporting on the server's configuration, because the
     * credential was the server's. This one reports on the caller, because
     * the credential is theirs — and "sign in again" is something the person
     * reading it can act on, while "a variable is unset" was not.
     *
     * Reachable in normal use: the middleware refuses an expired session on
     * the way in, but a session can expire between the page loading and the
     * button being pressed, and that lands here.
     */
    throw new NewsroomApiError(
      "Your newsroom session has ended. Sign in again to continue.",
      401,
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

    /*
     * The API's own 401 and 403 are forwarded rather than flattened to 502.
     *
     * They used to become "check NEWSROOM_API_TOKEN", which was fair when the
     * credential belonged to the server. Now they are two different facts
     * about the person at the keyboard, and both are actionable:
     *
     *   401 — the session ended, or the account's tokens were revoked. Sign
     *         in again. (The API revokes on password reset, so this is what a
     *         second device sees after somebody changes their password.)
     *   403 — signed in, and this role may not do that. A DEV reaching for a
     *         confidential record is the case that exists on purpose; telling
     *         them to check a token would send them hunting for a bug that is
     *         a policy.
     */
    if (response.status === 401) {
      throw new NewsroomApiError(
        "Your newsroom session has ended. Sign in again to continue.",
        401,
      );
    }
    if (response.status === 403) {
      throw new NewsroomApiError(
        detail ?? "Your account does not have access to that.",
        403,
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
