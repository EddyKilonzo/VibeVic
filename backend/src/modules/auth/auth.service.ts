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
import { Role } from '@prisma/client';
import type { Env } from '../../config/env';
import { type Principal, type Scope } from '../../common/authz/principal';
import type { TokenVerifier } from '../../common/authz/token-verifier';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';
import { scopesFor } from './roles';

/** What a successful sign-in returns. Shaped by `SessionPublicView`. */
export interface Session {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    scopes: Scope[];
  };
}

/**
 * Authentication.
 *
 * ── What changed, and why the old warning is gone ────────────────────────
 * This file used to say that verification was real and issuance was not, and
 * that the asymmetry was the safe half to build first. That was true while
 * there was no credential store. There is one now — `User.passwordHash`,
 * argon2id, and a role that decides scopes — so `issueToken` does what its
 * name says, and the README's "not safe to expose yet" no longer covers it.
 *
 * What arrived with it: password hashing (PasswordService), failure
 * throttling (below), single-use expiring reset links (PasswordResetService),
 * and revocation (`User.tokensValidFrom`). What still has not: refresh
 * tokens. A session lasts AUTH_TOKEN_TTL_MINUTES and then you sign in again,
 * which for a two-person newsroom is a fair trade against the machinery a
 * refresh flow needs to be safe.
 *
 * ── Scopes come from the database, not from the token ────────────────────
 * The JWT carries `sub` and little else, and `verifyJwt` loads the user to
 * decide what they may do. That costs one indexed primary-key lookup per
 * newsroom request, and buys three things worth more than the lookup: a role
 * change takes effect on the next request rather than in twelve hours, a
 * deleted account stops working immediately, and `tokensValidFrom` can end
 * every existing session — which is what "I think someone has my password"
 * has to mean if saying it is to be any use.
 *
 * Three modes still, chosen by AUTH_MODE, still defaulting to the one that
 * grants nothing.
 */
@Injectable()
export class AuthService implements TokenVerifier, OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  onModuleInit(): void {
    const mode = this.config.get('AUTH_MODE', { infer: true });
    if (mode === 'disabled') {
      this.logger.warn(
        'AUTH_MODE=disabled — every newsroom route answers 501. Public reads still work.',
      );
    }
    if (mode === 'dev') {
      const confidential = this.config.get('DEV_PRINCIPAL_CONFIDENTIAL', { infer: true });
      this.logger.warn(
        `AUTH_MODE=dev — a single local principal${
          confidential
            ? ', holding newsroom:confidential (DEV_PRINCIPAL_CONFIDENTIAL=true)'
            : ', no confidential scope'
        }. Never use outside a workstation.`,
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
   * Sign in.
   *
   * ── Every failure is the same failure ────────────────────────────────────
   * Unknown address, wrong password, an account that has never been given
   * one: all three answer 401 with one sentence. Telling them apart would
   * turn this endpoint into a way to ask "does this journalist have an
   * account here", which for a newsroom is a question worth refusing on its
   * own — the list of accounts is close to the list of who works on what.
   *
   * The timing is levelled too, by hashing against a decoy when there is no
   * user (see `PasswordService.verifyDummy`). A uniform message that answers
   * in a tenth of the time is not uniform.
   */
  async issueToken(credentials: LoginDto): Promise<Session> {
    if (this.config.get('AUTH_MODE', { infer: true }) !== 'jwt') {
      // Issuing a token nothing would accept is worse than refusing: the
      // caller would hold a credential and be refused by every route with a
      // 501 that says nothing about why.
      throw new NotImplementedException(
        'Token issuance requires AUTH_MODE=jwt. This server is not configured to sign in users.',
      );
    }

    const email = normaliseEmail(credentials.email);

    if (this.throttled(email)) {
      // 401 rather than 429, and deliberately the same sentence as a wrong
      // password: a distinct "too many attempts" reply confirms the address
      // is worth attacking, which is the thing being protected.
      this.logger.warn(`Login throttled for ${email}.`);
      throw new UnauthorizedException(SIGN_IN_REFUSED);
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    const ok = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, credentials.password)
      : await this.passwords.verifyDummy(credentials.password);

    if (!ok || !user) {
      this.recordFailure(email);
      throw new UnauthorizedException(SIGN_IN_REFUSED);
    }

    this.attempts.delete(email);

    /*
     * `lastLoginAt` is written before the token is returned, not after the
     * request finishes. It is the only record a person has of their own
     * account being used, and a value that is written on a best-effort basis
     * is a value nobody can reason from.
     */
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const ttlMinutes = this.config.get('AUTH_TOKEN_TTL_MINUTES', { infer: true });
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const token = await this.jwt.signAsync(
      // Nothing here is trusted at verify time except `sub`. The rest is
      // there so a token can be read in a debugger without a database.
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.requireSecret(),
        expiresIn: `${ttlMinutes}m`,
      },
    );

    this.logger.log(`Signed in ${user.email} (${user.role}).`);

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        scopes: scopesFor(user.role),
      },
    };
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

    /**
     * `newsroom:confidential` is withheld unless it is asked for by name.
     *
     * The argument for withholding it has not changed: a mode that exists so a
     * developer does not have to log in should not also hand out the identities
     * behind pseudonyms, and convenience and source protection do not belong in
     * the same grant. What has changed is the recognition that withholding it
     * unconditionally also makes part of the API untestable — interviews
     * default to CONFIDENTIAL, so on a default dev principal they cannot be
     * created and never appear in a list, and a surface nobody can exercise is
     * a surface nobody finds the bugs in.
     *
     * The resolution is an opt-in someone has to type into .env rather than a
     * default they inherit, and `AUTH_MODE=dev` is already refused outright
     * when NODE_ENV=production, so this cannot follow a deployment out.
     *
     * Note this is the same shape the DEV *role* takes in `roles.ts`, and for
     * the same reason. The env var predates the role and now reads as its
     * local echo.
     */
    const scopes: Scope[] = ['newsroom:read', 'newsroom:write', 'stories:write'];
    if (this.config.get('DEV_PRINCIPAL_CONFIDENTIAL', { infer: true })) {
      scopes.push('newsroom:confidential');
    }

    return {
      id: 'dev-principal',
      email: this.config.get('DEV_PRINCIPAL_EMAIL', { infer: true }) ?? 'dev@localhost',
      scopes,
    };
  }

  private async verifyJwt(token: string): Promise<Principal> {
    let claims: unknown;
    try {
      claims = await this.jwt.verifyAsync(token, { secret: this.requireSecret() });
    } catch {
      // The reason (expired, bad signature, malformed) stays server-side.
      throw new UnauthorizedException('Invalid token.');
    }

    const { subject, issuedAt } = readClaims(claims);

    const user = await this.prisma.user.findUnique({
      where: { id: subject },
      select: { id: true, email: true, role: true, tokensValidFrom: true },
    });

    // A deleted account's token stops working on the next request rather than
    // at its own expiry, which is the difference between removing someone and
    // asking them nicely to stop.
    if (!user) throw new UnauthorizedException('Invalid token.');

    /*
     * Revocation.
     *
     * `iat` is whole seconds while `tokensValidFrom` is a millisecond
     * timestamp, so the comparison is floored on both sides. Without that, a
     * token signed in the same second as a password change could round the
     * wrong way and survive the change that was meant to kill it.
     */
    if (issuedAt < Math.floor(user.tokensValidFrom.getTime() / 1000)) {
      throw new UnauthorizedException('Invalid token.');
    }

    return {
      id: user.id,
      email: user.email,
      scopes: scopesFor(user.role),
    };
  }

  private requireSecret(): string {
    const secret = this.config.get('AUTH_JWT_SECRET', { infer: true });
    if (!secret) {
      throw new NotImplementedException('AUTH_JWT_SECRET is not configured.');
    }
    return secret;
  }

  /* ── Failure throttling ─────────────────────────────────────────────────
   *
   * What this is: a speed bump, in this process's memory, keyed on the
   * address that was tried. What it is not: an access control. Nothing here
   * is shared between instances, so a deployment behind more than one of them
   * hands out a fresh allowance per instance, and a restart clears the lot.
   *
   * The same honest accounting as the sign-in form in the frontend, and the
   * same conclusion: it makes the obvious attack — a script and a wordlist
   * against one account — stop being free, and the real answer is a rate rule
   * at the edge or a shared store. Neither is a reason to have nothing.
   *
   * Keyed on email rather than IP on purpose. This is the half that protects
   * an account; an IP-keyed limit protects the server, and that job belongs
   * to something in front of it that can see all the traffic.
   */
  private readonly attempts = new Map<string, { count: number; first: number }>();
  private static readonly WINDOW_MS = 10 * 60 * 1000;
  private static readonly MAX_ATTEMPTS = 8;

  private throttled(email: string): boolean {
    const seen = this.attempts.get(email);
    if (!seen) return false;
    if (Date.now() - seen.first > AuthService.WINDOW_MS) {
      this.attempts.delete(email);
      return false;
    }
    return seen.count >= AuthService.MAX_ATTEMPTS;
  }

  private recordFailure(email: string): void {
    const now = Date.now();
    const seen = this.attempts.get(email);
    if (!seen || now - seen.first > AuthService.WINDOW_MS) {
      this.attempts.set(email, { count: 1, first: now });
      return;
    }
    seen.count += 1;
  }
}

/**
 * One sentence for every way a sign-in can fail.
 *
 * Exported nowhere and duplicated nowhere: if a second message ever appears
 * next to this one, the pair of them is the enumeration oracle this constant
 * exists to prevent.
 */
const SIGN_IN_REFUSED = 'That email and password were not recognised.';

/** Addresses are compared lowercased; `User.email` is stored the same way. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Claims → the two fields that are trusted. Everything else is decoration. */
function readClaims(claims: unknown): { subject: string; issuedAt: number } {
  if (typeof claims !== 'object' || claims === null) {
    throw new UnauthorizedException('Invalid token.');
  }
  const record = claims as Record<string, unknown>;
  const subject = typeof record.sub === 'string' ? record.sub : null;
  // Signed by us, so `iat` is always present — but a token missing it would
  // otherwise compare as 0 and pass the revocation check for ever.
  const issuedAt = typeof record.iat === 'number' ? record.iat : null;
  if (!subject || issuedAt === null) throw new UnauthorizedException('Invalid token.');
  return { subject, issuedAt };
}
