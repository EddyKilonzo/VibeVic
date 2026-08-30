"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, LogOut, Minus, ShieldCheck, Wrench } from "lucide-react";
import type { NewsroomRole } from "@/lib/newsroom-session";
import { capabilitiesFor } from "@/lib/role-capabilities";
import { signOut } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/Button";
import { forget } from "@/data/newsroom/store";
import { cn } from "@/lib/utils";

/**
 * Who you are signed in as, and how long that lasts.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The workspace knew none of this. A session was a cookie the middleware
 * checked and nothing on any screen said whose it was, which broke in three
 * ways at once. Two accounts on one machine could not tell each other apart,
 * so the honest question "am I in as me or as the dev account?" had no answer
 * short of signing out. The WRITER/DEV split was explained in prose on the
 * settings page and never applied to the person reading it, so a DEV met the
 * split as a record that would not load rather than as a fact about their own
 * account. And the twelve hours ran down invisibly: the first sign that a
 * session had ended was a page bouncing to the door, which on this product
 * means mid-edit.
 *
 * ── Where the facts come from ────────────────────────────────────────────
 * The session cookie, verified server-side in the layout and passed down.
 * Not a fetch: the claims are already in the request that rendered the page,
 * and a round trip to learn what the cookie already says would be a request
 * per navigation to display a line of text.
 *
 * What is shown is the token's word about the account, which is the right
 * scope for a label. It is not what decides anything — the API re-checks the
 * role against the database on every call that touches data, so a role
 * changed an hour ago is enforced now and merely displayed stale here until
 * the next sign-in. Worth knowing when reading the badge; not worth a
 * database round trip per page render to fix.
 */

export interface SessionSummary {
  email: string;
  role: NewsroomRole;
  /** Seconds since the epoch, as the JWT counts them. */
  expiresAt: number;
}

const ROLE_LABEL: Record<NewsroomRole, string> = {
  WRITER: "Writer",
  DEV: "Dev",
};

export function AccountMenu({ session }: { session: SessionSummary }) {
  const [open, setOpen] = useState(false);
  const remaining = useSecondsRemaining(session.expiresAt);
  const container = useRef<HTMLDivElement>(null);

  // Click-away and Escape. A popover that can only be closed by the button
  // that opened it is a popover people leave open.
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Icon = session.role === "WRITER" ? ShieldCheck : Wrench;
  const expired = remaining !== null && remaining <= 0;
  const expiring = remaining !== null && remaining > 0 && remaining <= WARN_AT_SECONDS;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "focus-ring tap flex h-10 items-center gap-2 rounded-lg px-2 text-sm transition-colors hover:bg-secondary",
          (expiring || expired) && "text-destructive",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full",
            session.role === "WRITER"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-primary ring-1 ring-border",
          )}
        >
          <Icon className="h-[15px] w-[15px]" />
        </span>
        {/* The address is the identity on a two-person team; the role is the
            thing you actually need at a glance. Both are in the panel, and
            only the role survives the narrow header. */}
        <span className="hidden max-w-[14ch] truncate md:inline">{ROLE_LABEL[session.role]}</span>
        {(expiring || expired) && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="sr-only">
          Signed in as {session.email} as a {ROLE_LABEL[session.role]}. Account menu.
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Account"
          className="surface absolute right-0 top-12 z-50 w-[290px] p-4 shadow-deep"
        >
          <p className="truncate text-sm font-semibold" title={session.email}>
            {session.email}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{ROLE_LABEL[session.role]}</p>

          <Capabilities role={session.role} />

          <SessionClock expiresAt={session.expiresAt} remaining={remaining} />

          {/* `forget()` before the action, because signing out is a client
              navigation and module state survives one. The cookie would be
              gone and the records would still be in memory, so the next
              person at the machine would find the workspace on screen. The
              server action still does the part that matters and still works
              with JavaScript off. */}
          <form action={signOut} onSubmit={() => forget()} className="mt-4">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * What this account can do, and the one thing it may not.
 *
 * ── Why the withheld row is shown rather than hidden ─────────────────────
 * A list of only what you can do leaves you to discover the boundary by
 * hitting it — which for a DEV means opening a source record, seeing a
 * pseudonym, and not knowing whether that is the whole truth or a permission
 * they do not have. Naming it, with the reason, turns a confusing absence
 * into a stated rule. It is also not a secret from the person holding the
 * account: the API enforces it whatever this panel says.
 *
 * The reason travels with the withheld line only. Four paragraphs of
 * justification under things you can already do is a panel nobody reads
 * twice.
 */
function Capabilities({ role }: { role: NewsroomRole }) {
  const { allowed, withheld } = capabilitiesFor(role);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="rule-label text-[10px]">What you can do</p>
      <ul className="mt-2 space-y-1.5">
        {allowed.map((capability) => (
          <li key={capability.label} className="flex gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span className="text-[11px] leading-relaxed" title={capability.detail}>
              {capability.label}
            </span>
          </li>
        ))}
        {withheld.map((capability) => (
          <li key={capability.label} className="flex gap-2">
            <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="line-through decoration-muted-foreground/40">
                {capability.label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-relaxed">
                {capability.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * How long is left, and what to say about it.
 *
 * Three states, because they need three different sentences. Hours left is a
 * fact worth stating quietly. Under thirty minutes is a warning, and the
 * number matters because the decision it informs — save this now, or start
 * something else — depends on it. Past zero is not a warning at all: the
 * session is gone, the next navigation will bounce, and the useful thing on
 * screen is the way back rather than a countdown to nothing.
 */
function SessionClock({
  expiresAt,
  remaining,
}: {
  expiresAt: number;
  remaining: number | null;
}) {
  if (remaining === null) {
    // First paint, before the effect has read a clock. Rendering a duration
    // here would mean the server's idea of "now" and the browser's, which are
    // never the same number, and React would call that a hydration error.
    return <p className="mt-3 h-4 text-[11px] text-muted-foreground" aria-hidden />;
  }

  if (remaining <= 0) {
    return (
      <p
        role="alert"
        className="mt-3 rounded-md bg-destructive/10 p-2.5 text-[11px] leading-relaxed text-destructive"
      >
        <span className="font-semibold">This session has ended.</span> Anything unsaved is still
        in this browser; sign in again in another tab before navigating away.
      </p>
    );
  }

  const ends = new Date(expiresAt * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (remaining <= WARN_AT_SECONDS) {
    return (
      <p
        role="status"
        className="mt-3 rounded-md bg-destructive/10 p-2.5 text-[11px] leading-relaxed text-destructive"
      >
        <span className="font-semibold">Ends in {formatRemaining(remaining)}</span>, at {ends}.
        Sign out and back in to start a fresh twelve hours — better now than in the middle of a
        draft.
      </p>
    );
  }

  return (
    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
      This session ends in {formatRemaining(remaining)}, at {ends}. There is no refresh — after
      that it is a fresh sign-in.
    </p>
  );
}

/** Thirty minutes: long enough to finish a paragraph and sign in again. */
const WARN_AT_SECONDS = 30 * 60;

/**
 * Counts down, and only in the browser.
 *
 * ── Why `useSyncExternalStore` and not state in an effect ────────────────
 * The clock is an external source that this component subscribes to, which is
 * exactly what this hook exists for. Written the obvious way — `useState`
 * plus an effect that seeds it — it renders once with a placeholder and
 * immediately again with a number, which is a cascading render on every
 * workspace page and which React's lint rules correctly refuse.
 *
 * The server snapshot is `null`, so the first client render matches the HTML
 * that arrived: the server's "now" and the browser's are never the same
 * number, and rendering a duration on both sides is a hydration mismatch by
 * construction.
 *
 * The snapshot is cached in the closure and only recomputed when the interval
 * fires. `getSnapshot` must return the same value when called twice in one
 * render, and a function reading `Date.now()` afresh each time does not — it
 * is right almost always, and "almost always" here means a render loop that
 * shows up on somebody else's machine.
 *
 * Thirty seconds. Nothing here is precise to the second, the display rounds
 * to minutes, and a per-second wake-up on every page of the workspace is
 * battery a laptop spends for no one.
 */
function useSecondsRemaining(expiresAt: number): number | null {
  // The mutable cell, which is what a ref is for. The store's value cannot
  // live in a closure the compiler can see being reassigned, and it cannot be
  // recomputed inside `getSnapshot` either — that has to return the same
  // value twice in one render, and a fresh `Date.now()` does not.
  const snapshot = useRef<number | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const read = () => Math.max(0, expiresAt - Math.floor(Date.now() / 1000));

      // React runs this in the effect phase, which is where a clock may be
      // read. The immediate notify is what turns the null first paint into a
      // number, through the store rather than around it.
      snapshot.current = read();
      onChange();

      const interval = window.setInterval(() => {
        snapshot.current = read();
        onChange();
        // Nothing left to count. The panel switches to "this session has
        // ended", which does not change again.
        if (snapshot.current <= 0) window.clearInterval(interval);
      }, TICK_MS);

      return () => window.clearInterval(interval);
    },
    [expiresAt],
  );

  return useSyncExternalStore(
    subscribe,
    () => snapshot.current,
    // The server has no clock this component may use: its "now" and the
    // browser's are never the same number, and rendering a duration on both
    // sides is a hydration mismatch by construction.
    () => null,
  );
}

const TICK_MS = 30_000;

function formatRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes} min`;
  return "less than a minute";
}
