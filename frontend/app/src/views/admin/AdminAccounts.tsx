"use client";

import { useState } from "react";
import { KeyRound, Mail, ShieldCheck, UserPlus, Wrench } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatRelative } from "@/lib/format";
import { notify } from "@/lib/toast";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import type { NewsroomRole } from "@/lib/newsroom-session";

/**
 * Accounts.
 *
 * ── What this replaces ───────────────────────────────────────────────────
 * `npm run account -- add|link|list`, which needed a shell with the
 * production `DATABASE_URL` in it. That tool is still there and is still the
 * way to create the very first account — nobody can sign in to this screen
 * until one exists — but "add a colleague" should not require production
 * access, and now it does not.
 *
 * ── Why there is no password field, and no link on screen ────────────────
 * Two separate refusals, and both are load-bearing.
 *
 * No password, for the reason the CLI gives: a password typed here is a
 * password that passed through somebody else's hands. An account is created
 * with none at all, and its owner chooses one from a single-use link.
 *
 * And that link is never shown here. It is emailed, and the API does not
 * return it — which is what stops `system:accounts` being a way around every
 * other scope. A developer can create a writer account; they cannot mint a
 * credential for it into their own browser without also holding that mailbox.
 * A "copy link" button would be more convenient and would quietly undo the
 * confidential boundary the rest of the product is built on.
 *
 * ── Why no control changes a role ────────────────────────────────────────
 * Same argument, one step further. An endpoint that moved an account between
 * roles would let the account that cannot see a protected identity grant
 * itself the ability to. Changing an existing role stays where it was: a
 * deliberate act at a database prompt, by somebody who already has that
 * access. The rows below say what each role is; nothing here edits it.
 */

interface Account {
  id: string;
  email: string;
  name: string;
  role: NewsroomRole;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  pendingLinkExpiresAt: string | null;
}

export default function AdminAccounts() {
  const { data, loading, error, reload } = useAsync<Account[]>(async () => {
    const response = await fetch("/api/newsroom/accounts", { cache: "no-store" });
    const body = (await response.json()) as Account[] & { error?: string };
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? "The account list could not be read.");
    }
    return body;
  }, []);

  return (
    <div className="mx-auto max-w-[900px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Workspace</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Accounts</h1>
        <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
          Who can sign in to the newsroom. Nobody&rsquo;s password passes through this screen:
          a new account is created without one, and its owner sets it from a single-use link
          sent to their own address.
        </p>
      </Reveal>

      <div className="mt-8 space-y-5">
        <NewAccount onCreated={reload} />

        {loading && <Skeleton className="h-48 w-full rounded-lg" />}

        {error && (
          <ErrorState
            title="The account list could not be read"
            description={error.message}
            onRetry={reload}
          />
        )}

        {data && (
          <Reveal variant="fade-up" className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold tracking-tight">
              {data.length === 1 ? "One account" : `${data.length} accounts`}
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {data.map((account) => (
                <AccountRow key={account.id} account={account} onSent={reload} />
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </div>
  );
}

function AccountRow({ account, onSent }: { account: Account; onSent: () => void }) {
  const [sending, setSending] = useState(false);
  const Icon = account.role === "WRITER" ? ShieldCheck : Wrench;

  const send = async () => {
    setSending(true);
    try {
      const response = await fetch(
        `/api/newsroom/accounts/${encodeURIComponent(account.id)}/setup-link`,
        { method: "POST" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        notify.error("The link was not sent", body.error ?? "Try again in a moment.");
        return;
      }
      notify.success(
        "Link sent",
        `${account.email} can set a password with it. It works once and expires.`,
      );
      // Refetch so the "link outstanding" line appears without a reload.
      onSent();
    } catch {
      notify.error("The link was not sent", "The newsroom could not be reached.");
    } finally {
      setSending(false);
    }
  };

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 py-4">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {account.role === "WRITER" ? "Writer" : "Dev"} ·{" "}
            {/* The state that actually explains "why can they not get in". */}
            {account.hasPassword ? "has a password" : "no password set yet"} ·{" "}
            {account.lastLoginAt
              ? `last signed in ${formatRelative(account.lastLoginAt)}`
              : "never signed in"}
          </p>
          {account.pendingLinkExpiresAt && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-accent">
              <Mail className="h-3 w-3" aria-hidden />
              A setup link is outstanding, good until{" "}
              {new Date(account.pendingLinkExpiresAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={send}
        loading={sending}
        loadingText="Sending"
      >
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        {account.hasPassword ? "Send a reset link" : "Send the setup link"}
      </Button>
    </li>
  );
}

/**
 * Creating one.
 *
 * Deliberately plain: three fields, no password, and a sentence saying what
 * happens next. The role is a choice of two because there are two — a select
 * with a third option nobody can pick is how a role nothing understands ends
 * up in the database.
 */
function NewAccount({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<NewsroomRole>("WRITER");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/newsroom/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        notify.error("The account was not created", body.error ?? "Check the details and retry.");
        return;
      }
      notify.success(
        "Account created",
        `${email.trim()} has been sent a link to set their password.`,
      );
      setEmail("");
      setName("");
      onCreated();
    } catch {
      notify.error("The account was not created", "The newsroom could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Reveal variant="fade-up" className="surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground">
          <UserPlus className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight">Add an account</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            They are emailed a link that works once. Nobody else ever holds their password,
            including you.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="rule-label text-[10px]">Name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="focus-ring mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Victor Kiplimo"
          />
        </label>

        <label className="text-sm">
          <span className="rule-label text-[10px]">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="focus-ring mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="name@example.com"
          />
        </label>

        <label className="text-sm">
          <span className="rule-label text-[10px]">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as NewsroomRole)}
            className="focus-ring mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="WRITER">Writer — reports and publishes</option>
            <option value="DEV">Dev — maintains the software</option>
          </select>
        </label>

        <div className="flex items-end">
          <Button type="submit" size="sm" loading={busy} loadingText="Creating" className="w-full">
            Create and send the link
          </Button>
        </div>
      </form>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        A role cannot be changed from here, on purpose — an account that can move another
        account between roles can grant itself anything. That stays a deliberate change at the
        database.
      </p>
    </Reveal>
  );
}
