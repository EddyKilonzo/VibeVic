import "server-only";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySession,
  type SessionClaims,
} from "./newsroom-session";
import { can, type Scope } from "./newsroom-scopes";

/**
 * Who is asking, on the server.
 *
 * ── Why a route checks as well as the middleware ─────────────────────────
 * The matcher covers the workspace and `/api/newsroom/:path*`, so a handler
 * under those prefixes is already gated by the time it runs. This is the
 * second lock, and it is here because the first one is configuration: a
 * matcher is edited by hand, a route can be moved, and the failure mode of
 * getting either wrong is an endpoint that spends money for anyone who finds
 * it. Two locks on that door is the right number.
 *
 * The cookie holds the API's own JWT, verified rather than merely present, so
 * a session that has outlived its window is refused here too rather than
 * trusted because it arrived.
 */
export async function currentSession(): Promise<SessionClaims | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * The bearer token to forward to the API, if this request has one.
 *
 * Returned raw and unexamined beyond `currentSession` having verified it: the
 * API is the party that decides what this token may do, and anything this app
 * concluded about it would be a second opinion nobody asked for.
 */
export async function sessionToken(): Promise<string | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return (await verifySession(cookie)) ? (cookie ?? null) : null;
}

/** Is this request coming from inside the newsroom? */
export async function isUnlocked(): Promise<boolean> {
  return (await currentSession()) !== null;
}

/**
 * Is this request coming from inside the newsroom *and* from a role that holds
 * this scope?
 *
 * ── Why a route checks a scope when the API will ─────────────────────────
 * The same two-lock argument as `isUnlocked`, one level in. The API is the
 * party that decides, and it re-derives the role from the database on every
 * call — so this is not the check that matters. What it buys is the shape of
 * the refusal: a route that forwards a request it knows will be refused spends
 * a round trip to turn a scope problem into whatever the proxy layer makes of
 * a 403, and the pitch route in particular would spend money on a model call
 * before anyone asked the API anything.
 *
 * Returns the outcome rather than throwing, because the three cases —
 * signed out, wrong role, allowed — are three different status codes and a
 * route handler has to pick one.
 */
export async function sessionWithScope(
  scope: Scope,
): Promise<{ ok: true; session: SessionClaims } | { ok: false; status: 401 | 403 }> {
  const session = await currentSession();
  if (!session) return { ok: false, status: 401 };
  if (!can(session.role, scope)) return { ok: false, status: 403 };
  return { ok: true, session };
}
