"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Ends the newsroom session.
 *
 * ── Why this had to exist ────────────────────────────────────────────────
 * The passphrase cookie lasts twelve hours and there was no way to end it
 * early. On a shared or borrowed machine that is the whole security model
 * failing quietly: the journalist closes the tab believing they have left,
 * and the workspace — drafts, sources, unpublished ideas — stays open to the
 * next person for the rest of the working day.
 *
 * A server action rather than a fetch, for the same reason the sign-in form
 * is one: the cookie is httpOnly, so only the server can remove it, and the
 * button keeps working with JavaScript disabled.
 */
export async function signOut() {
  (await cookies()).delete("vv_newsroom");
  // Not to "/": the middleware would send an unauthenticated request straight
  // back here anyway, and landing on the lock is the honest confirmation that
  // the session is over.
  redirect("/newsroom-access");
}
