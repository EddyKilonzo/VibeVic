import { Logger, NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { TEST_SECRET, fakeConfig, withClock } from '../../testing/doubles';
import { AuthService, normaliseEmail } from './auth.service';
import type { PasswordService } from './password.service';

/**
 * The sign-in and token-verification decisions.
 *
 * ── What is worth pinning here ───────────────────────────────────────────
 * Three things, and they are the three that go quietly wrong.
 *
 * The first is that every way of failing a sign-in produces one identical
 * refusal. That property is not visible in any single branch — it only exists
 * across all of them at once, which is exactly the kind of thing a later edit
 * breaks by adding one helpful message. A test that asserts the three
 * messages are the same object is the only place that intent survives.
 *
 * The second is that the JWT is trusted for `sub` and nothing else. The token
 * carries a `role` claim, and the day somebody reads it instead of loading the
 * user is the day a DEV can mint themselves `newsroom:confidential` with a
 * text editor. So there is a test that signs a token claiming WRITER for an
 * account the database says is DEV, and demands the DEV scopes.
 *
 * The third is revocation. `tokensValidFrom` is the whole answer to "someone
 * else may have my password", and the comparison has a floor in it because
 * `iat` is in seconds and the column is in milliseconds. That floor is one
 * line and reads like a rounding detail; without it a token signed in the
 * same second as the reset survives it.
 */

beforeAll(() => Logger.overrideLogger(false));

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string | null;
  tokensValidFrom: Date;
}

const HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$notarealdigest';

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user_1',
    email: 'vic@example.com',
    name: 'Victor',
    role: Role.WRITER,
    passwordHash: HASH,
    tokensValidFrom: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/**
 * Everything a spec needs to stand an `AuthService` up.
 *
 * `passwordCorrect` decides what the fake `PasswordService.verify` answers, so
 * a test can say "the row exists and the password is wrong" without owning an
 * argon2 digest. The real hashing is exercised in `password.service.spec.ts`;
 * mixing it in here would make every case in this file fifty milliseconds
 * slower for nothing.
 */
function build(options: {
  mode?: 'jwt' | 'dev' | 'disabled';
  user?: UserRow | null;
  passwordCorrect?: boolean;
  ttlMinutes?: number;
  secret?: string | undefined;
  devToken?: string;
  devConfidential?: boolean;
}) {
  const findUnique = jest.fn().mockResolvedValue(options.user ?? null);
  const update = jest.fn().mockResolvedValue(undefined);

  const prisma = {
    user: { findUnique, update },
  } as unknown as PrismaService;

  const verify = jest.fn().mockResolvedValue(options.passwordCorrect ?? false);
  const verifyDummy = jest.fn().mockResolvedValue(false);
  const passwords = { verify, verifyDummy } as unknown as PasswordService;

  const jwt = new JwtService({});

  const service = new AuthService(
    fakeConfig({
      AUTH_MODE: options.mode ?? 'jwt',
      AUTH_JWT_SECRET: 'secret' in options ? options.secret : TEST_SECRET,
      AUTH_TOKEN_TTL_MINUTES: options.ttlMinutes ?? 720,
      DEV_PRINCIPAL_TOKEN: options.devToken,
      DEV_PRINCIPAL_EMAIL: 'dev@localhost',
      DEV_PRINCIPAL_CONFIDENTIAL: options.devConfidential ?? false,
    }),
    jwt,
    prisma,
    passwords,
  );

  return { service, jwt, findUnique, update, verify, verifyDummy };
}

/** A token signed the way `issueToken` signs one, with the claims a test wants. */
async function signToken(
  jwt: JwtService,
  claims: Record<string, unknown>,
  options: { secret?: string; expiresIn?: string | number } = {},
): Promise<string> {
  return jwt.signAsync(claims, {
    secret: options.secret ?? TEST_SECRET,
    ...(options.expiresIn === undefined ? {} : { expiresIn: options.expiresIn }),
  });
}

describe('normaliseEmail', () => {
  it('lowercases and trims, because that is how the column is written', () => {
    expect(normaliseEmail('  Vic@Example.COM ')).toBe('vic@example.com');
  });
});

describe('AuthService.issueToken', () => {
  it('refuses to sign anything unless AUTH_MODE=jwt', async () => {
    const { service, findUnique } = build({ mode: 'dev', devToken: 'x'.repeat(16) });

    await expect(
      service.issueToken({ email: 'vic@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(NotImplementedException);

    // And it refuses before looking anybody up: a server that cannot issue a
    // token has no business reading the accounts table to say so.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('gives an unknown address, a wrong password and a password-less account the same refusal', async () => {
    const unknown = build({ user: null });
    const wrong = build({ user: userRow(), passwordCorrect: false });
    const unset = build({ user: userRow({ passwordHash: null }) });

    const messages = await Promise.all(
      [unknown, wrong, unset].map(async ({ service }) => {
        try {
          await service.issueToken({ email: 'vic@example.com', password: 'guess' });
          throw new Error('expected the sign-in to be refused');
        } catch (error) {
          expect(error).toBeInstanceOf(UnauthorizedException);
          return (error as UnauthorizedException).message;
        }
      }),
    );

    // One distinct message across all three. The moment this is two, the
    // endpoint answers "does this journalist have an account here".
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe('That email and password were not recognised.');
  });

  it('burns a hash on the no-such-user path so the timing does not answer either', async () => {
    const { service, verify, verifyDummy } = build({ user: null });

    await expect(
      service.issueToken({ email: 'nobody@example.com', password: 'guess' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyDummy).toHaveBeenCalledWith('guess');
    expect(verify).not.toHaveBeenCalled();
  });

  it('hashes against the decoy for an account that has never been given a password', async () => {
    const { service, verify, verifyDummy } = build({
      user: userRow({ passwordHash: null }),
      passwordCorrect: true,
    });

    await expect(
      service.issueToken({ email: 'vic@example.com', password: 'guess' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // `passwordCorrect: true` would have signed a token if the null hash were
    // ever passed to `verify`. An account awaiting its setup link is not a
    // account that anything can sign in to.
    expect(verify).not.toHaveBeenCalled();
    expect(verifyDummy).toHaveBeenCalled();
  });

  it('looks the account up by its normalised address', async () => {
    const { service, findUnique } = build({ user: userRow(), passwordCorrect: true });

    await service.issueToken({ email: '  VIC@Example.com ', password: 'right' });

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'vic@example.com' } });
  });

  it('returns a verifiable token, the role’s scopes, and an expiry that matches the TTL', async () => {
    const clock = withClock(Date.parse('2026-06-01T12:00:00.000Z'));
    try {
      const { service, jwt, update } = build({
        user: userRow(),
        passwordCorrect: true,
        ttlMinutes: 60,
      });

      const session = await service.issueToken({
        email: 'vic@example.com',
        password: 'right',
      });

      expect(session.user).toEqual({
        id: 'user_1',
        email: 'vic@example.com',
        name: 'Victor',
        role: Role.WRITER,
        scopes: ['newsroom:read', 'newsroom:write', 'newsroom:confidential', 'stories:write'],
      });

      // The frontend sets its cookie's max-age from this string, so a drift
      // between it and the token's own `exp` is a browser that believes it is
      // signed in while every request is refused.
      expect(session.expiresAt).toBe('2026-06-01T13:00:00.000Z');

      const claims = await jwt.verifyAsync<{ sub: string; exp: number }>(session.token, {
        secret: TEST_SECRET,
      });
      expect(claims.sub).toBe('user_1');
      expect(claims.exp).toBe(Math.floor(Date.parse('2026-06-01T13:00:00.000Z') / 1000));

      expect(update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { lastLoginAt: new Date('2026-06-01T12:00:00.000Z') },
      });
    } finally {
      clock.restore();
    }
  });

  it('gives a DEV the DEV scopes, and never the confidential one', async () => {
    const { service } = build({
      user: userRow({ role: Role.DEV }),
      passwordCorrect: true,
    });

    const session = await service.issueToken({ email: 'vic@example.com', password: 'right' });

    expect(session.user.scopes).toEqual(['newsroom:read', 'newsroom:write', 'stories:write']);
    expect(session.user.scopes).not.toContain('newsroom:confidential');
  });

  it('refuses when no signing secret is configured rather than signing with nothing', async () => {
    const { service } = build({
      user: userRow(),
      passwordCorrect: true,
      secret: undefined,
    });

    await expect(
      service.issueToken({ email: 'vic@example.com', password: 'right' }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});

describe('AuthService sign-in throttling', () => {
  it('stops reading the database once an address has burned its allowance', async () => {
    const { service, findUnique } = build({ user: userRow(), passwordCorrect: false });
    const credentials = { email: 'vic@example.com', password: 'guess' };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(service.issueToken(credentials)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(findUnique).toHaveBeenCalledTimes(8);

    await expect(service.issueToken(credentials)).rejects.toBeInstanceOf(UnauthorizedException);
    // The ninth was refused without a lookup — and with the same sentence, so
    // being throttled is not itself a signal that the address is worth having.
    expect(findUnique).toHaveBeenCalledTimes(8);
  });

  it('keys the count on the address, so one account’s failures do not lock another out', async () => {
    const { service, findUnique } = build({ user: userRow(), passwordCorrect: false });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(
        service.issueToken({ email: 'vic@example.com', password: 'guess' }),
      ).rejects.toThrow();
    }

    await expect(
      service.issueToken({ email: 'someone@example.com', password: 'guess' }),
    ).rejects.toThrow();

    expect(findUnique).toHaveBeenCalledTimes(9);
  });

  it('forgets the failures once the window has passed', async () => {
    const clock = withClock(Date.parse('2026-06-01T12:00:00.000Z'));
    try {
      const { service, findUnique } = build({ user: userRow(), passwordCorrect: false });
      const credentials = { email: 'vic@example.com', password: 'guess' };

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await expect(service.issueToken(credentials)).rejects.toThrow();
      }
      await expect(service.issueToken(credentials)).rejects.toThrow();
      expect(findUnique).toHaveBeenCalledTimes(8);

      clock.advance(10 * 60 * 1000 + 1);

      await expect(service.issueToken(credentials)).rejects.toThrow();
      expect(findUnique).toHaveBeenCalledTimes(9);
    } finally {
      clock.restore();
    }
  });

  it('clears the count on a successful sign-in', async () => {
    const { service, verify, findUnique } = build({ user: userRow() });
    const credentials = { email: 'vic@example.com', password: 'guess' };

    verify.mockResolvedValue(false);
    for (let attempt = 0; attempt < 7; attempt += 1) {
      await expect(service.issueToken(credentials)).rejects.toThrow();
    }

    verify.mockResolvedValue(true);
    await service.issueToken(credentials);

    // Seven failures, one success, then eight more failures: all eight reach
    // the database, which they could not if the earlier seven still counted.
    verify.mockResolvedValue(false);
    findUnique.mockClear();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(service.issueToken(credentials)).rejects.toThrow();
    }
    expect(findUnique).toHaveBeenCalledTimes(8);
  });
});

describe('AuthService.verifyToken', () => {
  it('answers 501 rather than 401 when authentication is switched off', async () => {
    const { service } = build({ mode: 'disabled' });

    // Nothing is wrong with the caller's credential; the server has no way to
    // check one. A 401 would send an operator hunting for a password.
    await expect(service.verifyToken('anything')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  describe('in dev mode', () => {
    const devToken = 'local-dev-token-1234';

    it('accepts the configured token and withholds the confidential scope', async () => {
      const { service } = build({ mode: 'dev', devToken });

      const principal = await service.verifyToken(devToken);

      expect(principal.email).toBe('dev@localhost');
      expect(principal.scopes).toEqual(['newsroom:read', 'newsroom:write', 'stories:write']);
    });

    it('grants the confidential scope only when it is asked for by name', async () => {
      const { service } = build({ mode: 'dev', devToken, devConfidential: true });

      const principal = await service.verifyToken(devToken);

      expect(principal.scopes).toContain('newsroom:confidential');
    });

    it('refuses a token of the wrong length without throwing out of the comparison', async () => {
      const { service } = build({ mode: 'dev', devToken });

      // `timingSafeEqual` throws on mismatched lengths, so the guard in front
      // of it is load-bearing: without it this is a 500, and a 500 for the
      // wrong length against a 401 for the wrong value is a length oracle.
      await expect(service.verifyToken('short')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.verifyToken(`${devToken}extra`)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('in jwt mode', () => {
    it('loads the role from the database and ignores the one in the token', async () => {
      const { service, jwt } = build({ user: userRow({ role: Role.DEV }) });

      // A token that claims to be a writer, for an account that is not one.
      const forged = await signToken(jwt, {
        sub: 'user_1',
        email: 'vic@example.com',
        role: Role.WRITER,
      });

      const principal = await service.verifyToken(forged);

      expect(principal.scopes).not.toContain('newsroom:confidential');
      expect(principal.scopes).toEqual(['newsroom:read', 'newsroom:write', 'stories:write']);
    });

    it('refuses a token signed with a different secret', async () => {
      const { service, jwt } = build({ user: userRow() });

      const foreign = await signToken(jwt, { sub: 'user_1' }, { secret: 'a'.repeat(40) });

      await expect(service.verifyToken(foreign)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses an unsigned token', async () => {
      const { service } = build({ user: userRow() });

      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url',
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: 'user_1', iat: Math.floor(Date.now() / 1000) }),
      ).toString('base64url');

      await expect(service.verifyToken(`${header}.${payload}.`)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses an expired token', async () => {
      const { service, jwt } = build({ user: userRow() });

      const stale = await signToken(
        jwt,
        { sub: 'user_1', iat: Math.floor(Date.now() / 1000) - 7200 },
        { expiresIn: '-1h' },
      );

      await expect(service.verifyToken(stale)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses a token whose account has been deleted', async () => {
      const { service, jwt } = build({ user: null });

      const orphan = await signToken(jwt, { sub: 'user_gone' });

      // Not at the token's own expiry — now. The difference between removing
      // somebody and asking them nicely to stop.
      await expect(service.verifyToken(orphan)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses a token with no iat, which would otherwise outlive every revocation', async () => {
      const { service, jwt } = build({ user: userRow() });

      // `jsonwebtoken` adds `iat` unless told not to. A token without one
      // would compare as 0 against `tokensValidFrom` and pass for ever.
      const token = await jwt.signAsync(
        { sub: 'user_1' },
        { secret: TEST_SECRET, noTimestamp: true },
      );

      await expect(service.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    describe('revocation', () => {
      const resetAt = Date.parse('2026-06-01T12:00:00.000Z');

      it('refuses a token issued before the account’s revocation clock', async () => {
        const { service, jwt } = build({
          user: userRow({ tokensValidFrom: new Date(resetAt) }),
        });

        const before = await signToken(jwt, {
          sub: 'user_1',
          iat: Math.floor(resetAt / 1000) - 1,
        });

        await expect(service.verifyToken(before)).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('accepts a token issued after it', async () => {
        const { service, jwt } = build({
          user: userRow({ tokensValidFrom: new Date(resetAt) }),
        });

        const after = await signToken(jwt, {
          sub: 'user_1',
          iat: Math.floor(resetAt / 1000) + 1,
        });

        await expect(service.verifyToken(after)).resolves.toMatchObject({ id: 'user_1' });
      });

      it('floors both sides, so a sub-second reset cannot be survived by rounding', async () => {
        // The reset landed 750ms into the second. `iat` for a token signed in
        // that same second is the floor of it, so an unfloored comparison
        // reads the token as older than the reset and keeps it alive.
        const { service, jwt } = build({
          user: userRow({ tokensValidFrom: new Date(resetAt + 750) }),
        });

        const sameSecond = await signToken(jwt, {
          sub: 'user_1',
          iat: Math.floor(resetAt / 1000),
        });

        await expect(service.verifyToken(sameSecond)).resolves.toMatchObject({ id: 'user_1' });
      });
    });
  });
});
