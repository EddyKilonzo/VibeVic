import "server-only";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySession,
  type SessionClaims,
} from "./newsroom-session";

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
