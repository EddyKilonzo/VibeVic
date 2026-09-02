import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Who is asking, and what they are allowed to ask for.
 *
 * ── Why scopes rather than one "is journalist" boolean ───────────────────
 * Because the two roles are not a ladder. They were once — DEV held a subset
 * of WRITER, so the only thing the split could express was "less" — and a
 * subset is not a division of labour, it is a demotion. What the newsroom
 * actually has is two jobs that need different things: one person reports and
 * publishes, the other keeps the software running. Each holds scopes the
 * other does not, so neither list is a prefix of the other and the boundary
 * runs in both directions.
 *
 * ── The four questions these scopes keep apart ───────────────────────────
 * Reading the working notes, reading the identity behind a pseudonym, putting
 * a piece in front of the public, and operating the machine it runs on are
 * four different acts. Collapsing any two of them into one scope is how an
 * account ends up able to do something nobody decided it should.
 */

export const SCOPES = [
  'newsroom:read',
  'newsroom:write',
  /** Reads confidential records at all — including learning that they exist. */
  'newsroom:confidential',
  /**
   * Opens the notebook: ideas, pitches, and the desk that works an idea up.
   *
   * Separate from `newsroom:read` because an unpublished story idea is not the
   * same kind of secret as an interview transcript. A transcript is material
   * for a piece that has been decided on; an idea is the decision itself,
   * still being made, and it is the writer's alone until it is not. The dev
   * account needs records to reproduce a bug against and has never needed to
   * know what Victor is thinking of writing next.
   */
  'newsroom:ideas',
  'stories:write',
  /**
   * Puts a story on the public site, or takes it down again.
   *
   * Split off `stories:write` on the argument the publish route already makes:
   * publishing is not a status column write. Editing a draft is craft and the
   * dev account needs it to fix an editor bug; deciding that a piece is ready
   * for readers is editorial judgement, and software maintenance never
   * requires it.
   */
  'stories:publish',
  /**
   * Reads how the deployment is actually behaving — database reachability,
   * migration state, which integrations are configured, what is failing.
   *
   * Dev-side, and genuinely useless to a writer: the answer to "is the API
   * up" that a journalist needs is the connection badge in the header, not a
   * migration list. Held by the account that would be asked to fix it.
   */
  'system:diagnostics',
  /**
   * Administers accounts: who exists, what role they hold, issuing the
   * single-use link somebody sets their first password with.
   *
   * This lived only in `npm run account` on a machine with the database URL on
   * it, which meant the person who maintains the software was the only one who
   * could do it and had to do it from a terminal. Making it a scope does not
   * widen that — it is still dev-only — it just stops the operation requiring
   * shell access to production.
   *
   * Deliberately not held by WRITER. An account administrator can create an
   * account, and an account is a way in; keeping that with the person who
   * already holds the deployment's keys adds no new risk, whereas granting it
   * to a second role would.
   */
  'system:accounts',
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

export interface Principal {
  id: string;
  email: string;
  scopes: readonly Scope[];
}

export function hasScope(principal: Principal, scope: Scope): boolean {
  return principal.scopes.includes(scope);
}

/** Key the guard writes the authenticated principal onto the request under. */
export const PRINCIPAL_REQUEST_KEY = 'vvPrincipal' as const;

interface RequestWithPrincipal {
  [PRINCIPAL_REQUEST_KEY]?: Principal;
}

/**
 * `@CurrentPrincipal()` — undefined on public routes, present on newsroom
 * routes because the guard refuses the request otherwise. Services still
 * re-check rather than trusting that (see AccessPolicyService): a controller
 * that forgets a decorator should not be able to open a hole.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    return request[PRINCIPAL_REQUEST_KEY];
  },
);
