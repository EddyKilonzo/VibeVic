"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SessionSummary } from "./AccountMenu";
import { can, type Scope } from "@/lib/newsroom-scopes";

/**
 * Who is signed in, for the client components under the workspace.
 *
 * ── Why a context and not a prop ─────────────────────────────────────────
 * The role is verified once, server-side, in `app/admin/layout.tsx`, and it
 * is already being handed to `AdminLayout` to draw the account menu. The
 * things that need it after that are scattered — a publish button deep in the
 * story workspace, a rail in the shell — and threading one string through
 * four intermediate components that have no interest in it is how a prop ends
 * up copied into local state and going stale.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 * A permission check. `useCan` answers "should this control be drawn", which
 * is a question about the interface. Whether the action succeeds is decided
 * by the API, on the caller's own token, on every request — so a button this
 * hook hides is a button that would have been refused anyway, and a bug here
 * is a missing control rather than an open door.
 */

const SessionContext = createContext<SessionSummary | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionSummary;
  children: ReactNode;
}) {
  // Memoised on the three fields rather than on the object, because the
  // layout re-renders on every navigation and a fresh object identity each
  // time would re-render every consumer for no change.
  const value = useMemo(
    () => session,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.email, session.role, session.expiresAt],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Throws outside the provider rather than returning null.
 *
 * Every caller is under `app/admin`, which cannot render without a verified
 * session — so "no session here" is not a state to handle, it is a component
 * that has been moved somewhere it does not belong, and the loudest available
 * signal is the right one.
 */
export function useNewsroomSession(): SessionSummary {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useNewsroomSession was called outside the newsroom workspace.");
  }
  return session;
}

/** Should this control be drawn for the signed-in role? */
export function useCan(scope: Scope): boolean {
  return can(useNewsroomSession().role, scope);
}
