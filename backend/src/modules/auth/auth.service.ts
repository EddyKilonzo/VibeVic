import { timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotImplementedException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { isScope, type Principal, type Scope } from '../../common/authz/principal';
import type { TokenVerifier } from '../../common/authz/token-verifier';
import type { LoginDto } from './dto/login.dto';

/**
 * Authentication.
 *
 * Verification is real; issuance is not. That asymmetry is deliberate and is
 * the safe half to build first — a server that can check a credential but not
 * mint one is closed, while the reverse is an open door with a lock on the
 * inside. Until `issueToken` exists there is no user table, no password
 * hashing, no rotation and no revocation, and the README says so out loud.
 *
 * Three modes, chosen by AUTH_MODE, defaulting to the one that grants nothing.
 */
@Injectable()
export class AuthService implements TokenVerifier, OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit(): void {
    const mode = this.config.get('AUTH_MODE', { infer: true });
    if (mode === 'disabled') {
      this.logger.warn(
        'AUTH_MODE=disabled — every newsroom route answers 501. Public reads still work.',
      );
    }
    if (mode === 'dev') {
      this.logger.warn(
        'AUTH_MODE=dev — a single local principal, no confidential scope. Never use outside a workstation.',
      );
    }
  }

  async verifyToken(token: string): Promise<Principal> {
    switch (this.config.get('AUTH_MODE', { infer: true })) {
      case 'disabled':
        // 501, not 401: nothing is wrong with the caller's credential — the
        // server has no way to check one. Saying "unauthorised" would send an
        // operator hunting for a password that does not exist.
        throw new NotImplementedException(
          'Newsroom authentication is not configured (AUTH_MODE=disabled).',
        );
      case 'dev':
        return this.verifyDevToken(token);
      case 'jwt':
        return this.verifyJwt(token);
    }
  }

  /**
   * Local convenience credential. Compared in constant time — a shared secret
   * compared with `===` leaks its prefix to anyone willing to time the request,
   * and the habit matters more here than the specific risk.
   */
  private verifyDevToken(token: string): Principal {
    const expected = this.config.get('DEV_PRINCIPAL_TOKEN', { infer: true }) ?? '';
    const given = Buffer.from(token);
    const want = Buffer.from(expected);
    const ok = given.length === want.length && timingSafeEqual(given, want);
    if (!ok) throw new UnauthorizedException('Invalid token.');

    return {
      id: 'dev-principal',
      email: this.config.get('DEV_PRINCIPAL_EMAIL', { infer: true }) ?? 'dev@localhost',
      // No newsroom:confidential. A mode that exists so a developer does not
      // have to log in should not also hand out the identities behind
      // pseudonyms; convenience and source protection do not belong in the
      // same grant.
      scopes: ['newsroom:read', 'newsroom:write', 'stories:write'],
    };
  }

  private async verifyJwt(token: string): Promise<Principal> {
    const secret = this.config.get('AUTH_JWT_SECRET', { infer: true });
    if (!secret) {
      throw new NotImplementedException('AUTH_JWT_SECRET is not configured.');
    }

    let claims: unknown;
    try {
      claims = await this.jwt.verifyAsync(token, { secret });
    } catch {
      // The reason (expired, bad signature, malformed) stays server-side.
      throw new UnauthorizedException('Invalid token.');
    }

    return toPrincipal(claims);
  }

  /**
   * Not implemented, and not faked.
   *
   * A stub that returned a token would be an authentication bypass wearing a
   * TODO. What is missing: a credential store, password hashing (argon2id),
   * rate limiting on failures, refresh and revocation, and a decision about who
   * may hold `newsroom:confidential` and for how long.
   */
  issueToken(_credentials: LoginDto): Promise<never> {
    throw new NotImplementedException(
      'Token issuance is not implemented. See README, "Not safe to expose yet".',
    );
  }
}

/** Claims → principal, dropping anything unrecognised rather than trusting it. */
function toPrincipal(claims: unknown): Principal {
  if (typeof claims !== 'object' || claims === null) {
    throw new UnauthorizedException('Invalid token.');
  }
  const record = claims as Record<string, unknown>;
  const id = typeof record.sub === 'string' ? record.sub : null;
  const email = typeof record.email === 'string' ? record.email : null;
  if (!id || !email) throw new UnauthorizedException('Invalid token.');

  const raw = Array.isArray(record.scopes) ? record.scopes : [];
  // Unknown scope strings are discarded, not passed through. A scope this build
  // does not recognise cannot be checked, and an unchecked scope is not a grant.
  const scopes: Scope[] = raw.filter(isScope);

  return { id, email, scopes };
}
