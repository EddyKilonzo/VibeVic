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
 * ── The split, and why neither list contains the other ───────────────────
 * WRITER used to be DEV plus one scope. That made the roles a ladder with two
 * rungs, and a ladder can only ever say that one account is trusted less than
 * another — which was never the intent and was not true of the work. The two
 * accounts do different jobs.
 *
 * WRITER is the journalist. Theirs is the notebook and the front page:
 * ideas and pitches, the name behind a pseudonym, and the decision to put a
 * piece in front of readers or pull it back down. All three are editorial
 * acts. None of them has a software-maintenance reason to exist.
 *
 * DEV maintains the software. Theirs is the machine: the health of the
 * deployment, and the accounts that can sign in to it. Records and drafts are
 * shared, because a bug is reproduced against real shapes and an editor bug
 * cannot be fixed without opening the editor.
 *
 * ── What each is deliberately refused, and why that is not seniority ─────
 * DEV cannot see a protected identity, cannot open the ideas notebook, and
 * cannot publish. Read forwards that looks like the lesser account; read for
 * what the refusals *are*, it is the account that cannot expose a source,
 * cannot read what has not been decided yet, and cannot put anything in front
 * of the public. That is the account that lives on a laptop, gets pasted into
 * a terminal and signs in from a support session — and the blast radius of it
 * being compromised is now bounded by exactly those three refusals.
 *
 * WRITER cannot read diagnostics and cannot administer accounts. Not because
 * Victor is not trusted with them — he owns the thing — but because they are
 * not his work, and a scope nobody uses is a scope that is only ever exercised
 * by somebody who should not have it.
 */
export const ROLE_SCOPES: Readonly<Record<Role, readonly Scope[]>> = {
  /**
   * The journalist. The newsroom, the notebook, the front page.
   */
  [Role.WRITER]: [
    'newsroom:read',
    'newsroom:write',
    'newsroom:confidential',
    'newsroom:ideas',
    'stories:write',
    'stories:publish',
  ],
  /**
   * Maintains the software. Reads and writes the newsroom so a bug can be
   * reproduced against real shapes, operates the deployment, and stops at the
   * three scopes that would turn a compromised developer account into a source
   * disclosure, a look at unpublished thinking, or an unreviewed publication.
   */
  [Role.DEV]: [
    'newsroom:read',
    'newsroom:write',
    'stories:write',
    'system:diagnostics',
    'system:accounts',
  ],
};

/** A fresh array per call — the table above must not be handed out by reference. */
export function scopesFor(role: Role): Scope[] {
  return [...ROLE_SCOPES[role]];
}
