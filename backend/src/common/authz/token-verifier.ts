import type { Principal } from './principal';

/**
 * The guard depends on this interface, not on AuthService.
 *
 * Keeps the direction of dependency honest — the privacy machinery in
 * `common/` never imports a feature module — and makes the guard testable
 * against a stub verifier without standing up the auth module's config.
 */
export interface TokenVerifier {
  /**
   * Resolve a bearer token to a principal.
   *
   * Contract: throw on anything that is not a valid, current credential.
   * Returning `undefined`, `null` or an anonymous principal is not permitted —
   * a verifier that can return "nobody, but carry on" would let the guard fall
   * through into an unauthenticated newsroom request.
   */
  verifyToken(token: string): Promise<Principal>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
