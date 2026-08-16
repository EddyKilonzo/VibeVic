import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const surface =
      this.reflector.getAllAndOverride<Surface>(SURFACE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? Surface.Newsroom;

    if (surface === Surface.Public) return true;

    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
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
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  const token = value.trim();
  return token.length > 0 ? token : null;
}
