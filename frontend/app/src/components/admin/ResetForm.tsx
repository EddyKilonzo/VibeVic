"use client";

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { resetAction, type FormState } from "@/app/newsroom-access/actions";
import { Button } from "@/components/ui/Button";
import { AccessCard, Field, Unconfigured } from "./AccessCard";

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
 */
export function ResetForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetAction, {});

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
          hint="At least 12 characters."
          invalid={Boolean(state.error)}
          describedBy={state.error ? "reset-error" : undefined}
        />

        <Field
          id="confirm"
          name="confirm"
          label="And again"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(state.error)}
          describedBy={state.error ? "reset-error" : undefined}
        />

        {state.error ? (
          <p id="reset-error" role="alert" className="mt-3 text-sm text-destructive">
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
