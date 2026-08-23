import "server-only";

import { cookies } from "next/headers";
import { verifyToken } from "./newsroom-token";

/**
 * Is this request coming from inside the newsroom?
 *
 * ── Why a route checks as well as the middleware ─────────────────────────
 * The matcher covers `/admin/:path*` and `/api/newsroom/:path*`, so a
 * handler under those prefixes is already gated by the time it runs. This is
 * the second lock, and it is here because the first one is configuration: a
 * matcher is edited by hand, a route can be moved, and the failure mode of
 * getting either wrong is an endpoint that spends money for anyone who finds
 * it. Two locks on that door is the right number.
 *
 * The token is the same signed, expiring one the gate checks — verified, not
 * merely present, so a cookie that has outlived its window is refused here
 * too rather than trusted because it arrived.
 */
export async function isUnlocked(): Promise<boolean> {
  return verifyToken((await cookies()).get("vv_newsroom")?.value);
}
