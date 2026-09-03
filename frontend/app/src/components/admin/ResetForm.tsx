"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, KeyRound, Minus } from "lucide-react";
import { resetAction, type FormState } from "@/app/newsroom-access/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { AccessCard, Field, Unconfigured } from "./AccessCard";

/**
 * The server's floor, repeated here so the screen can show it being met.
 *
 * `resetAction` checks the same number and the API checks it again in
 * `ResetPasswordDto`. Three checks, one of which a person can see before they
 * commit to anything — which is the one that stops the failure happening.
 */
const MIN_LENGTH = 12;

/**
 * Choose a new password.
 *
 * ── Where the token goes ─────────────────────────────────────────────────
 * It arrives in the query string, because a link in an email has nowhere else
 * to put it, and it leaves in a POST body. A URL is written to browser
 * history, to the `Referer` of anything the page loads, and to every proxy
 * log in between; a form body is not. The hidden field is the handover
 * between those two facts.
 *
 * ── And it is taken back out of the address bar ──────────────────────────
 * Once this component has the token in memory, the URL is rewritten to the
 * bare path. Everything that could be done about the token *in transit* has
 * been — `no-referrer` on this route, `no-store` so no cache keeps the page,
 * a single-use token stored only as a SHA-256 — and what is left is the part
 * none of that touches: the credential sitting in the address bar of a screen
 * that may be shared, photographed, recorded by support tooling, or simply
 * read over a shoulder in a newsroom. It also stops the URL being the thing
 * somebody pastes into a chat when asking for help.
 *
 * What this is *not* is obfuscation. The token is exactly as strong as it was
 * — 256 bits of `randomBytes`, spent on first use — and hiding the string
 * would add nothing to that; a link that has to work when clicked cannot be
 * made secret by being made ugly. This narrows where a working credential is
 * left lying about, which is a real and much smaller claim.
 *
 * ── The second field is not security ─────────────────────────────────────
 * Both fields are masked and the link is single-use, so a typo here is not an
 * inconvenience — it is being locked out of an account with the one link
 * already spent. Confirming is checked on the server, so it also holds for a
 * browser running no JavaScript.
 *
 * ── This is the first-password screen too ────────────────────────────────
 * An account created by `npm run account -- add` has no password at all and
 * is handed a link to this page. Which means this flow is exercised every
 * time somebody joins, rather than only on the rare day somebody forgets —
 * and a path that is walked often is a path that still works.
 *
 * ── Why the rules are shown being met, not reported afterwards ───────────
 * Both rules used to be enforced only on submit, and both failures cost the
 * same thing: the form comes back, the two masked fields are empty again, and
 * the sentence explaining why is below the button that was just pressed. For
 * "twelve characters" that is a slow way to learn a number; the API's own
 * wording for it — "password must be longer than or equal to 12 characters" —
 * is what a person gets if they reach it from anywhere but this form.
 *
 * So both are answered while they are being typed. The server still decides:
 * nothing here is disabled and nothing is blocked, because this form has to
 * work for someone on a borrowed machine with JavaScript off, and a submit
 * button that looks broken is worse than one that answers.
 */
export function ResetForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetAction, {});
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  /*
   * Take the token out of the address bar, keeping it in the field above.
   *
   * `replaceState` rather than `router.replace`: the App Router's version
   * re-runs the route's server component, which would hand this form a fresh
   * `token` prop of `undefined` and swap it for the "no token in that
   * address" branch while somebody is typing their password into it. Changing
   * only the address is the whole of what is wanted.
   *
   * The current history state is passed straight back rather than `null`. The
   * router keeps its own state there, and wiping it re-initialises the router
   * from nothing — the same trap `StoryWorkspace` documents when it renames a
   * new draft's URL.
   *
   * Replace, never push: a back button that returned to the URL carrying the
   * token would undo this entirely.
   */
  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    if (!window.location.search) return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [token]);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = password.length > 0 && confirmation === password;
  const typing = password.length > 0 || confirmation.length > 0;

  if (!token) {
    return (
      <AccessCard
        icon={<KeyRound className="h-5 w-5" aria-hidden />}
        title="Choose a password"
        intro="This page needs the link from your email."
      >
        <Unconfigured>
          <span className="font-semibold text-foreground">No token in that address.</span> Open the
          link from the email itself rather than typing this page in — the token is the part after{" "}
          <code className="text-xs">?token=</code>, and it is the whole of what proves the request
          is yours.
        </Unconfigured>

        <Button
          as={Link}
          href="/newsroom-access/forgot"
          variant="outline"
          className="mt-6 w-full"
        >
          Ask for a new link
        </Button>
      </AccessCard>
    );
  }

  return (
    <AccessCard
      icon={<KeyRound className="h-5 w-5" aria-hidden />}
      title="Choose a password"
      intro="Setting it here signs out every device that is currently signed in to this account, including this one."
      footnote="Twelve characters at least, and no rules about symbols — a long ordinary phrase is harder to guess than a short one with punctuation in it."
    >
      <form action={action} className="mt-7">
        <input type="hidden" name="token" value={token} />

        <Field
          id="password"
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          onValueChange={setPassword}
          invalid={Boolean(state.error)}
          describedBy={state.error ? "reset-error" : undefined}
        />

        <Field
          id="confirm"
          name="confirm"
          label="And again"
          type="password"
          autoComplete="new-password"
          onValueChange={setConfirmation}
          invalid={Boolean(state.error)}
          describedBy={state.error ? "reset-error" : undefined}
        />

        {/*
          Polite rather than assertive: this updates on almost every keystroke,
          and an assertive region would interrupt a screen reader mid-word to
          announce a character count. The list is the hint for both fields, so
          it sits under the pair rather than under either one.
        */}
        <ul aria-live="polite" className="mt-4 space-y-1.5">
          <Rule met={longEnough} idle={!typing}>
            {longEnough
              ? "Long enough"
              : password.length === 0
                ? `At least ${MIN_LENGTH} characters`
                : `${MIN_LENGTH - password.length} more ${
                    MIN_LENGTH - password.length === 1 ? "character" : "characters"
                  }`}
          </Rule>
          <Rule met={matches} idle={confirmation.length === 0}>
            {matches ? "Both match" : "Both entries match"}
          </Rule>
        </ul>

        {state.error ? (
          <p id="reset-error" role="alert" className="mt-4 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" loading={pending} className="mt-5 w-full">
          Set this password
        </Button>

        <p className="mt-4 text-center text-[13px]">
          <Link
            href="/newsroom-access/forgot"
            className="focus-ring rounded text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Link expired? Ask for another
          </Link>
        </p>
      </form>
    </AccessCard>
  );
}

/**
 * One line of the checklist.
 *
 * Three states, not two. `idle` is the field nobody has touched yet, and it
 * reads as information rather than as a rule already broken — a red cross on
 * an empty form is the screen telling somebody off for not having typed
 * anything. Colour is never the only signal: the mark changes shape too.
 */
function Rule({
  met,
  idle,
  children,
}: {
  met: boolean;
  idle: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-[12px] leading-relaxed transition-colors",
        met ? "text-accent" : idle ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {met ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Minus className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      )}
      <span>{children}</span>
    </li>
  );
}
