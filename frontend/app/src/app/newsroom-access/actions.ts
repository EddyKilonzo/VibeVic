"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { completeReset, requestReset, signIn } from "@/lib/auth-api";
import { NEWSROOM_BASE } from "@/lib/newsroom-path";
import { SESSION_COOKIE } from "@/lib/newsroom-session";

/**
 * The three server actions behind the door.
 *
 * ── Why they are here and not inline in the forms ────────────────────────
 * There used to be one, defined inside `AccessForm.tsx`, which was the right
 * shape for one. There are three now and they share a set of decisions —
 * where a person may be sent, how long a cookie lives, what a failure is
 * allowed to say. Three copies of those decisions is three chances for one of
 * them to be different, and the one that is different is the one with the
 * open redirect in it.
 *
 * ── What is no longer here ───────────────────────────────────────────────
 * The in-memory attempt counter. It kept a Map of failures per IP address in
 * this process, with a comment admitting that serverless instances do not
 * share memory and that it was a speed bump rather than a control. The
 * throttle lives in the API now, keyed on the account rather than the caller,
 * which is the right key: it is an account being attacked, not a server, and
 * an attacker who rotates addresses does not rotate the account they want.
 *
 * What moving it did not do is make it shared. `AuthService` keeps its own
 * Map in its own process and says so at the declaration — so a second API
 * instance hands out a second full allowance, and a restart clears the count.
 * Deleting the copy here was still right, because two per-process counters
 * are not better than one and the frontend's was keyed on the wrong thing.
 * But the honest description of what guards this form is one speed bump
 * rather than a control, and it stays that way until the count lives
 * somewhere both instances can see — a column on the account, or Redis.
 * Anything written here that implied otherwise would be describing a
 * protection that does not exist.
 *
 * The fixed 400ms pause on failure has gone with it, for a plainer reason:
 * the API hashes against a decoy for unknown accounts, so its answers already
 * take the same time as each other. Adding delay on this side would slow the
 * honest case without changing what an attacker measures.
 */

export interface FormState {
  error?: string;
  /** Set by the forgot form, which has nothing to redirect to. */
  sent?: boolean;
}

export async function signInAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? NEWSROOM_BASE);

  if (!email || !password) {
    return { error: "Enter both your email and your password." };
  }

  const result = await signIn(email, password);
  if (!result.ok) return { error: result.error };

  const { token, expiresAt } = result.value;

  /*
   * The cookie expires when the token does, not on a constant of our own.
   *
   * The two used to be set separately — a `SESSION_SECONDS` here and an
   * expiry inside the token there — which meant they could disagree, and the
   * visible symptom of disagreeing is a browser that still believes it is
   * signed in while every request is refused. Reading `maxAge` off the
   * token's own expiry makes that impossible rather than merely unlikely.
   */
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  // Only ever to a path on this site, and only ever into the workspace: an
  // open redirect on a sign-in form is a phishing primitive, and one that
  // accepted any local path would still be a way to bounce someone off the
  // door they just unlocked.
  redirect(next.startsWith(NEWSROOM_BASE) ? next : NEWSROOM_BASE);
}

/**
 * Ask for a link.
 *
 * Answers "sent" whether or not the address has an account, because the API
 * does. A form that said "no such account" would be a way to ask which
 * journalists work here, and for a newsroom the list of accounts is close to
 * the list of who is working on what.
 *
 * The one thing that can still fail visibly is a server with no mailer
 * configured. That is a fact about this deployment rather than about the
 * address, so it is safe to show, and showing it is how whoever set it up
 * finds out.
 */
export async function forgotAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "Enter the email address on your account." };

  const result = await requestReset(email);
  return result.ok ? { sent: true } : { error: result.error };
}

export async function resetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm") ?? "");

  if (!token) {
    return { error: "That link is missing its token. Ask for a new one." };
  }
  /*
   * The two fields are compared here rather than in the browser.
   *
   * A mismatch caught in client JavaScript is caught for people who have it,
   * and this form has to work for someone signing in on a borrowed machine
   * with whatever it is running. It is also not a security check — it exists
   * so nobody locks themselves out with a typo they cannot see, which is a
   * real risk when the field is masked and the link is single-use.
   */
  if (password !== confirmation) {
    return { error: "Those two passwords are not the same." };
  }
  if (password.length < 12) {
    return { error: "Use at least 12 characters. A short phrase beats a short password." };
  }

  const result = await completeReset(token, password);
  if (!result.ok) return { error: result.error };

  /*
   * Straight to the sign-in page, not into the workspace.
   *
   * Setting a session here would be convenient and would also mean that
   * spending a reset link logs you in — so anyone who reads the email is in,
   * without ever knowing the password they just set. Making them type it once
   * is a second, cheap proof, and it is the moment the new password is most
   * likely to be remembered.
   */
  redirect("/newsroom-access?reset=1");
}
