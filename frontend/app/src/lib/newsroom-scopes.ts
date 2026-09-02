import type { NewsroomRole } from "./newsroom-session";

/**
 * What each role holds, mirrored from the API.
 *
 * ── This is a mirror, and the original is `roles.ts` in the API ──────────
 * Nothing here gates anything. The API derives scopes from the account's role
 * on every request and re-checks them against the database; this table exists
 * so a screen can decide what to *draw* without a round trip per navigation.
 * If the two ever disagree, this one is wrong — and being wrong here shows up
 * as a link that leads to a 403, which is a bug worth having rather than a
 * hole. Being wrong in the other direction, where the screen is the only
 * check, is the one that is not survivable.
 *
 * ── Why mirror it at all rather than send the scopes down ────────────────
 * The token already carries the role, verified in the layout, and the role is
 * the input this table takes. Sending an array of scope strings in the JWT
 * would make the claim larger, put the permission model in something the
 * browser can read, and still have to be re-derived server-side because a
 * signed claim is a snapshot and a role can change. One small table, kept
 * next to the sentence explaining that it is a copy, is the cheaper mistake.
 */
export const SCOPES = [
  "newsroom:read",
  "newsroom:write",
  "newsroom:confidential",
  "newsroom:ideas",
  "stories:write",
  "stories:publish",
  "system:diagnostics",
  "system:accounts",
] as const;

export type Scope = (typeof SCOPES)[number];

/** Kept in the same order as the API's table, so a diff between them reads. */
export const ROLE_SCOPES: Readonly<Record<NewsroomRole, readonly Scope[]>> = {
  WRITER: [
    "newsroom:read",
    "newsroom:write",
    "newsroom:confidential",
    "newsroom:ideas",
    "stories:write",
    "stories:publish",
  ],
  DEV: [
    "newsroom:read",
    "newsroom:write",
    "stories:write",
    "system:diagnostics",
    "system:accounts",
  ],
};

/** Does this role hold this scope? The one question screens ask. */
export function can(role: NewsroomRole, scope: Scope): boolean {
  return ROLE_SCOPES[role].includes(scope);
}
