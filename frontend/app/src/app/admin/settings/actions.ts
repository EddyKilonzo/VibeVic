"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/newsroom-session";

/**
 * Ends the newsroom session.
 *
 * ── Why this had to exist ────────────────────────────────────────────────
 * The session cookie lasts twelve hours and there was no way to end it early.
 * On a shared or borrowed machine that is the whole security model failing
 * quietly: the journalist closes the tab believing they have left, and the
 * workspace — drafts, sources, unpublished ideas — stays open to the next
 * person for the rest of the working day.
 *
 * ── What it does not do ──────────────────────────────────────────────────
 * It drops this browser's cookie. It does not revoke the token, which stays
 * valid until it expires — so this ends a session on the machine in front of
 * you and no other. The blunt instrument for "end every session everywhere"
 * is a password reset, which moves the account's revocation clock forward
 * and refuses every token older than it. Two different problems, and it is
 * worth them having two different answers rather than one button that
 * quietly does more than it says.
 *
 * A server action rather than a fetch, for the same reason the sign-in form
 * is one: the cookie is httpOnly, so only the server can remove it, and the
 * button keeps working with JavaScript disabled.
 */
export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  /*
   * Out to the public site, not back to the lock.
   *
   * This used to land on `/newsroom-access`, reasoning that the sign-in form
   * is the honest confirmation that the session ended. It is — and it is also
   * a form, which is a thing that asks to be filled in. Somebody who has just
   * deliberately left is handed the door they left by, with their email
   * probably still autofilled in it; on the borrowed machine this button
   * exists for, the next person finds the newsroom's address and a waiting
   * password field rather than an ordinary website.
   *
   * The site root says the same thing without the invitation: you are on the
   * public pages now, which is where somebody who is not signed in belongs.
   * The way back is the footer's sign-in link, one click away and reached
   * deliberately rather than by having been left there.
   */
  redirect("/");
}
