"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { signInAction, type FormState } from "@/app/newsroom-access/actions";
import { NEWSROOM_BASE } from "@/lib/newsroom-path";
import { Button } from "@/components/ui/Button";
import { AccessCard, Field, Unconfigured } from "./AccessCard";

/**
 * Sign in to the newsroom.
 *
 * ── What this used to be ─────────────────────────────────────────────────
 * One passphrase field, compared on the server against `NEWSROOM_PASSPHRASE`
 * with `timingSafeEqual`, and a footnote admitting it was not an account
 * system because there was no backend to hold users or roles. There is one
 * now. This asks for an email and a password, the API checks them against an
 * argon2id hash, and the session it returns says which of the two roles the
 * person holds.
 *
 * ── Still a form action, still no fetch ──────────────────────────────────
 * The password is posted to a server action and compared on the server; it
 * never reaches client JavaScript beyond the input it was typed into, and
 * there is no XHR carrying it that an extension can read off the page. The
 * `useActionState` hook is here for the error message rather than for the
 * submission — without JavaScript the form still posts and the page still
 * comes back with the same sentence on it.
 *
 * ── Why the door no longer explains the roles ────────────────────────────
 * There was a footnote here setting out the WRITER/DEV split and naming what
 * a writer can see that a dev cannot. It was accurate and it was in the wrong
 * place twice over. Nobody reading a sign-in form needs the authorisation
 * model — they need to sign in — and the people who can reach this page
 * include everybody on the internet who finds it, so it published which role
 * to go after and what that role is worth. What each account may do is now
 * shown to the account, in the workspace, once it has proved who it is.
 *
 * ── Why every failure says the same thing ────────────────────────────────
 * The message comes from the API, which answers "that email and password were
 * not recognised" to a wrong password, an unknown address, an account with no
 * password yet, and one that has been throttled. This form does not try to
 * improve on it. Distinguishing them here would only reconstruct, on the
 * screen, the account-enumeration oracle the API is careful not to be.
 */
export function AccessForm({
  next,
  unconfigured,
  reset,
}: {
  next?: string;
  unconfigured?: boolean;
  /** Arrived here from a completed password reset. */
  reset?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});

  return (
    <AccessCard
      icon={<Lock className="h-5 w-5" aria-hidden />}
      title="Newsroom access"
      intro="The workspace holds drafts, sources and notes that are not published. It is not part of the public site."
    >
      {unconfigured ? (
        <Unconfigured>
          <span className="font-semibold text-foreground">No signing secret is configured.</span>{" "}
          The workspace stays locked until <code className="text-xs">AUTH_JWT_SECRET</code> is set
          here and on the API, with the same value in both. A missing secret locks the door rather
          than opening it.
        </Unconfigured>
      ) : (
        <form action={action} className="mt-7">
          <input type="hidden" name="next" value={next ?? NEWSROOM_BASE} />

          {reset ? (
            <p
              role="status"
              className="mb-5 flex gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm leading-relaxed"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="text-muted-foreground">
                Your password is set. Sign in with it once, and it is yours.
              </span>
            </p>
          ) : null}

          <Field
            id="email"
            name="email"
            label="Email"
            type="email"
            autoComplete="username"
            invalid={Boolean(state.error)}
            describedBy={state.error ? "sign-in-error" : undefined}
          />

          <Field
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(state.error)}
            describedBy={state.error ? "sign-in-error" : undefined}
          />

          {state.error ? (
            <p id="sign-in-error" role="alert" className="mt-3 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" loading={pending} className="mt-5 w-full">
            Unlock the workspace
          </Button>

          <p className="mt-4 text-center text-[13px]">
            <Link
              href="/newsroom-access/forgot"
              className="focus-ring rounded text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Forgotten your password?
            </Link>
          </p>
        </form>
      )}
    </AccessCard>
  );
}
