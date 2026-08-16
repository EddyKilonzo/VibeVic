import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Who is asking, and what they are allowed to ask for.
 *
 * Scopes are separate rather than a single "is journalist" boolean because
 * `newsroom:confidential` needs to be grantable on its own. Reading the working
 * notes and reading the identity behind a pseudonym are different acts, and the
 * dev auth mode is allowed to do the first but never the second.
 */

export const SCOPES = [
  'newsroom:read',
  'newsroom:write',
  /** Reads confidential records at all — including learning that they exist. */
  'newsroom:confidential',
  'stories:write',
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
