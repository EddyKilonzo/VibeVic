import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Env } from '../../config/env';
import {
  isScope,
  PRINCIPAL_REQUEST_KEY,
  type Principal,
  type Scope,
} from './principal';
import {
  REQUIRED_SCOPES_KEY,
  SURFACE_KEY,
  Surface,
} from './surface.decorator';
import { TOKEN_VERIFIER, type TokenVerifier } from './token-verifier';

/**
 * The door.
 *
 * Registered globally, and the default when a route says nothing is
 * `Surface.Newsroom` — so a new controller is private until someone writes
 * `@PublicRead` on it and, in doing so, has to name the public view its output
 * is projected through. The safe path is the one you get by doing nothing; the
 * exposed path costs two deliberate keystrokes and shows up in a diff.
 */
@Injectable()
export class NewsroomGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const surface =
      this.reflector.getAllAndOverride<Surface>(SURFACE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? Surface.Newsroom;

    if (surface === Surface.Public) return true;

    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();

    if (surface === Surface.Machine) return this.admitScheduler(request);
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Newsroom access requires a bearer token.');
    }

    // Any throw from the verifier propagates unchanged: in `disabled` auth mode
    // it is a 501, which tells an operator the truth ("no auth is configured")
    // instead of a 401 that would suggest their password was wrong.
    const principal = await this.verifier.verifyToken(token);

    const required = (
      this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    ).filter(isScope);

    const missing = required.filter((scope: Scope) => !principal.scopes.includes(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing scope(s): ${missing.join(', ')}`);
    }

    (request as Record<string, unknown>)[PRINCIPAL_REQUEST_KEY] = principal satisfies Principal;
    return true;
  }
  /**
   * The scheduler's door: one shared secret in a header, compared in constant
   * time, and no principal on the way through.
   *
   * ── Why an unset secret is a refusal ─────────────────────────────────────
   * A missing `CRON_SECRET` could mean "this deployment has no scheduler" or
   * "somebody forgot", and the two are indistinguishable from in here. Opening
   * the route in that state would make the second one silent, so it answers
   * 501 — the same answer `AUTH_MODE=disabled` gives, and for the same reason:
   * an unconfigured control is a closed door, not an absent one.
   *
   * ── Why the comparison is constant-time ──────────────────────────────────
   * `===` on strings returns as soon as two bytes differ, and the difference
   * is measurable across a network given enough attempts. This route is
   * unauthenticated by design and can be called as often as anybody likes, so
   * it is the one place in this codebase where that attack is actually
   * practical. The lengths are compared first because `timingSafeEqual` throws
   * on a mismatch — which leaks the length, and nothing else.
   */
  private admitScheduler(request: Request): boolean {
    const expected = this.config.get('CRON_SECRET', { infer: true });
    if (!expected) {
      throw new NotImplementedException(
        'No scheduler is configured on this deployment. Set CRON_SECRET to enable it.',
      );
    }

    const header = request.headers['x-vv-cron-key'];
    const offered = Array.isArray(header) ? header[0] : header;
    if (!offered) {
      throw new UnauthorizedException('This route is called by the scheduler.');
    }

    const a = Buffer.from(offered);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('This route is called by the scheduler.');
    }

    return true;
  }

}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  const token = value.trim();
  return token.length > 0 ? token : null;
}
