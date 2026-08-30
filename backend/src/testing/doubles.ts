import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * Test doubles, shared by the auth specs.
 *
 * ── Why these are hand-written and not `Test.createTestingModule` ─────────
 * Nest's testing module builds a DI container, which is the right tool when
 * what is under test is the wiring — a guard reaching a controller, a
 * provider resolving. Nothing here is. These specs are about the decisions
 * inside three services, and a container between the test and the service
 * only adds a place for the test to pass because a mock was registered
 * somewhere rather than because the code is right.
 *
 * ── Why no database ──────────────────────────────────────────────────────
 * The real Prisma client talks to Neon. A test suite that needs a network and
 * somebody's credentials to run is a suite that stops being run — and the
 * properties worth pinning here (which message a failure gets, whether a
 * token's role claim is believed, whether a reset row is written as a hash)
 * are decisions in TypeScript, not behaviours of Postgres. What the database
 * genuinely owns — the unique index on `tokenHash`, the transaction — is not
 * something a fake could honestly assert about anyway.
 *
 * This file is excluded from `tsconfig.build.json`, so it is typechecked with
 * everything else and never reaches `dist`.
 */

/**
 * A `ConfigService` that answers from a plain object.
 *
 * The cast is the point of the function: it happens once, here, rather than
 * at every call site. `ConfigService.get` is overloaded five ways around
 * `infer`, and satisfying that signature honestly in a double would be more
 * type gymnastics than the thing being tested.
 */
export function fakeConfig(values: Partial<Env>): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

/** A secret long enough to satisfy the same 32-character floor `env.ts` sets. */
export const TEST_SECRET = 'test-signing-secret-of-sufficient-length';

/**
 * Advances a fake clock between assertions.
 *
 * ── Why not `jest.useFakeTimers` ─────────────────────────────────────────
 * Argon2 hashing is real async work on a real thread. Freezing the timer
 * queue around it means a test that hangs rather than one that fails, and a
 * hanging test is the kind people delete.
 *
 * ── Why the constructor and not just `Date.now` ──────────────────────────
 * This replaced `Date.now` alone at first, which is enough for the throttles
 * and for the expiry arithmetic — both read `Date.now()` explicitly. It is
 * not enough for `new Date()`, which reads the real clock through a path that
 * never touches `Date.now`, and `AuthService` writes `lastLoginAt` that way.
 * A half-frozen clock is worse than none: the parts of a test that happen to
 * use the frozen half pass, and the assertion that catches the drift is the
 * one that looks broken.
 *
 * Everything else about `Date` is left alone — `parse`, `UTC` and the
 * prototype all come from the real one through the prototype chain, so an
 * instance made here is a real `Date` and `instanceof` still holds.
 */
export function withClock(startMs: number): {
  advance: (ms: number) => void;
  restore: () => void;
} {
  const RealDate = Date;
  let now = startMs;

  const Fake = function (this: unknown, ...args: unknown[]): Date {
    const Ctor = RealDate as unknown as new (...parameters: unknown[]) => Date;
    // No arguments means "now", which is the only case being answered
    // differently. Every other form is the real constructor untouched.
    return args.length === 0 ? new Ctor(now) : new Ctor(...args);
  } as unknown as DateConstructor;

  // Statics — `parse`, `UTC` — reached through the prototype chain rather than
  // copied, so nothing has to be kept in step with them.
  Object.setPrototypeOf(Fake, RealDate);
  // `defineProperty` because `DateConstructor.prototype` is declared readonly;
  // the underlying function property is writable, and sharing the real
  // prototype is what keeps `instanceof Date` true while this is installed.
  Object.defineProperty(Fake, 'prototype', { value: RealDate.prototype });
  Fake.now = () => now;

  globalThis.Date = Fake;

  return {
    advance: (ms: number) => {
      now += ms;
    },
    restore: () => {
      globalThis.Date = RealDate;
    },
  };
}
