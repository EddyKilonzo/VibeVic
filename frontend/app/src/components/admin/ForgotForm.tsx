"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailQuestion, Send } from "lucide-react";
import { forgotAction, type FormState } from "@/app/newsroom-access/actions";
import { Button } from "@/components/ui/Button";
import { AccessCard, Field } from "./AccessCard";

/**
 * "I have forgotten my password."
 *
 * ── The screen has to lie about nothing and reveal nothing ───────────────
 * Those two are in tension, and the resolution is in the wording. It does not
 * say "we have sent you an email", which would be false for an address with
 * no account. It says what the server actually did: if that address has an
 * account, a link is on its way. Every reader of that sentence learns the
 * same amount, which is the point — a form that confirmed an address would be
 * a way to ask which journalists work here, and in a newsroom the roster is
 * close to a list of who is working on what.
 *
 * ── Why the confirmation replaces the form ───────────────────────────────
 * Leaving the field on screen invites a second press, and a second press is a
 * second email, a cancelled first link, and a person holding two messages
 * where the older one no longer works. The way back is a link to the door,
 * not the same button again.
 */
export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotAction, {});

  if (state.sent) {
    return (
      <AccessCard
        icon={<Send className="h-5 w-5" aria-hidden />}
        title="Check your email"
        intro="If that address has a newsroom account, a link to choose a new password is on its way. It works once, and it expires."
      >
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Nothing has changed yet. Your current password still works until you use the link — so
          if you remember it in the meantime, ignore the email.
        </p>

        <Button as={Link} href="/newsroom-access" variant="outline" className="mt-6 w-full">
          Back to sign in
        </Button>
      </AccessCard>
    );
  }

  return (
    <AccessCard
      icon={<MailQuestion className="h-5 w-5" aria-hidden />}
      title="Forgotten password"
      intro="Give the address on your account and the newsroom will email a link for setting a new password."
      footnote="The link is a working credential until it is used. It is sent to the account's own address and nowhere else."
    >
      <form action={action} className="mt-7">
        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="username"
          invalid={Boolean(state.error)}
          describedBy={state.error ? "forgot-error" : undefined}
        />

        {state.error ? (
          <p id="forgot-error" role="alert" className="mt-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" loading={pending} className="mt-5 w-full">
          Email me a link
        </Button>

        <p className="mt-4 text-center text-[13px]">
          <Link
            href="/newsroom-access"
            className="focus-ring rounded text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AccessCard>
  );
}
