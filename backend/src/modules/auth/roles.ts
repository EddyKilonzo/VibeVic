import { Role } from '@prisma/client';
import type { Scope } from '../../common/authz/principal';

/**
 * What each role may do, in one table.
 *
 * ── Why this is code and not data ────────────────────────────────────────
 * `User.scopes` used to be a string array on the row, described in the schema
 * as a scaffold. The trouble with a scaffold like that is not that it is
 * untidy — it is that a permission becomes something an UPDATE can grant. One
 * statement in a console, no diff, no review, and `newsroom:confidential`
 * lands on an account that was never meant to hold it. Deriving scopes from a
 * role means the only way to widen what somebody may see is to edit this file,
 * and that edit is visible to whoever reads the commit.
 *
 * ── The split, and why it is not seniority ───────────────────────────────
 * WRITER holds more than DEV, which reads backwards until you look at what
 * the extra scope actually is. `newsroom:confidential` is the name behind a
 * pseudonym. That belongs to the person doing the reporting, because
 * protecting a source and knowing who they are cannot be separated. It does
 * not belong to the person fixing a migration, who needs records to work with
 * and never needs a real identity to do it.
 *
 * The practical effect is the one worth having: the account that lives on a
 * laptop, gets pasted into a terminal and signs in from a support session is
 * the account that cannot expose anyone.
 */
export const ROLE_SCOPES: Readonly<Record<Role, readonly Scope[]>> = {
  /** The journalist. Everything, confidential included. */
  [Role.WRITER]: ['newsroom:read', 'newsroom:write', 'newsroom:confidential', 'stories:write'],
  /**
   * Maintains the software. Reads and writes the newsroom so a bug can be
   * reproduced against real shapes, and stops at the one scope that would
   * turn a compromised developer account into a source disclosure.
   */
  [Role.DEV]: ['newsroom:read', 'newsroom:write', 'stories:write'],
};

/** A fresh array per call — the table above must not be handed out by reference. */
export function scopesFor(role: Role): Scope[] {
  return [...ROLE_SCOPES[role]];
}
