import "server-only";

import type { NewsroomRole } from "./newsroom-session";

/**
 * The three unauthenticated calls this app makes to the API.
 *
 * ── Why these do not go through `newsroomFetch` ──────────────────────────
 * That helper forwards the caller's session token and refuses when there
 * isn't one. Every call in this file exists precisely because there is no
 * session — signing in, asking for a reset link, spending one. Routing them
 * through a helper whose first act is to demand a credential would be a
 * circle, and the "just skip the check in this case" flag it would need is
 * the kind of flag that ends up set somewhere else.
 *
 * ── What is returned, and why not exceptions ─────────────────────────────
 * A result object rather than a throw. These are called from server actions
 * that answer a form: every outcome, including a refusal, is a page the
 * person needs to see with a sentence on it. Exceptions would mean each
 * caller wrapping every call in a try/catch to turn it back into exactly
 * this shape.
 *
 * The API's own message is passed through for 4xx, because those are written
 * for a person and say which thing was wrong ("that reset link has expired").
 * A 5xx message is not; it describes the server's internals, so it stays in
 * the log and the caller gets a sentence written here.
 */

const BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

export interface Session {
  token: string;
  expiresAt: string;
  user: { id: string; email: string; name: string; role: NewsroomRole; scopes: string[] };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Email and password in; a session out, or one sentence saying no. */
export async function signIn(email: string, password: string): Promise<Result<Session>> {
  return post<Session>("/auth/token", { email, password }, {
    // The API answers every failed sign-in with one message by design, so
    // there is nothing to improve on here — pass its words through.
    fallback: "Could not reach the newsroom to sign in. Try again in a moment.",
  });
}

/**
 * Ask for a reset link.
 *
 * Succeeds whether or not the address has an account — the API answers 202
 * either way, and this function must not become the place that difference
 * leaks back out.
 */
export async function requestReset(email: string): Promise<Result<null>> {
  const result = await post<unknown>("/auth/forgot-password", { email }, {
    fallback: "Could not reach the newsroom. Try again in a moment.",
  });
  return result.ok ? { ok: true, value: null } : result;
}

/** Spend a reset link and set the new password. */
export async function completeReset(token: string, password: string): Promise<Result<null>> {
  const result = await post<unknown>("/auth/reset-password", { token, password }, {
    fallback: "Could not reach the newsroom. Your password has not been changed.",
  });
  return result.ok ? { ok: true, value: null } : result;
}

async function post<T>(
  path: string,
  body: Record<string, unknown>,
  options: { fallback: string },
): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      // Shorter than the fifteen seconds `newsroomFetch` allows. Somebody is
      // watching a spinner on a sign-in form, and a form that hangs for
      // fifteen seconds gets its button pressed again.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    console.error(`[auth-api] POST ${path} failed:`, cause);
    return { ok: false, error: options.fallback };
  }

  if (!response.ok) {
    const detail = await messageFrom(response);
    // The body is never logged: on these three routes it holds a password or
    // a reset token. The path and the status are the whole of what is safe.
    console.error(`[auth-api] POST ${path} -> ${response.status}`);
    if (response.status >= 400 && response.status < 500) {
      return { ok: false, error: detail ?? options.fallback };
    }
    if (response.status === 503) {
      // The API says a thing it needs is not configured, and names it. That
      // sentence is for whoever deployed this, and it reaches them fastest by
      // being on the screen rather than only in a log.
      return { ok: false, error: detail ?? options.fallback };
    }
    return { ok: false, error: options.fallback };
  }

  try {
    return { ok: true, value: (await response.json()) as T };
  } catch (cause) {
    console.error(`[auth-api] unreadable body from ${path}:`, cause);
    return { ok: false, error: options.fallback };
  }
}

async function messageFrom(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) {
        return message.filter((item): item is string => typeof item === "string").join("; ");
      }
    }
  } catch {
    // A non-JSON error body is ordinary. The status still carries the meaning.
  }
  return null;
}
