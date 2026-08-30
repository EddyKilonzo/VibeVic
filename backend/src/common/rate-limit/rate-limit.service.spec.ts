import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { withClock } from '../../testing/doubles';
import { RateLimitService } from './rate-limit.service';

/**
 * The limiter, minus the statement Postgres runs.
 *
 * ── What a fake can and cannot say here ──────────────────────────────────
 * The atomicity is the point of the raw SQL and it is not testable without a
 * database — a fake `$queryRaw` proves nothing about what two concurrent
 * writers see. So this file does not pretend to. What it pins is everything
 * around the statement, which is where the bugs that matter to a caller live:
 * the boundary (is the eighth attempt allowed, or the ninth?), the key the
 * count lands under, and the direction it fails when the database is gone.
 *
 * The boundary is the one worth writing down twice. `count` comes back
 * including the hit that produced it, so the comparison is `count <= limit`
 * and not `<`. Getting that wrong costs exactly one attempt — invisible in
 * every manual test, and a bug either way you look at it.
 */

beforeAll(() => Logger.overrideLogger(false));

const LIMIT = { limit: 3, windowMs: 60_000 };

const START = Date.parse('2026-06-01T12:00:00.000Z');

function build() {
  // Counts like the real statement does: one row per key, reset when the
  // window has closed. Enough to exercise the service's arithmetic; not a
  // claim about what Postgres does under contention.
  const rows = new Map<string, { count: number; windowAt: number }>();

  // Typed with both halves of a `Prisma.sql` template: `values` for the
  // parameters, `strings` for the literal text between them. A test asserts
  // that a caller's input only ever appears in the first.
  const queryRaw = jest.fn(async (query: { values: unknown[]; strings: string[] }) => {
    // The parameters, in the order the template interpolates them:
    // key, now, now, windowOpenedAfter, windowOpenedAfter, now, now.
    const [key, stamp, , cutoff] = query.values as [string, Date, Date, Date];
    const existing = rows.get(key);

    const fresh = !existing || existing.windowAt <= cutoff.getTime();
    const next = fresh
      ? { count: 1, windowAt: stamp.getTime() }
      : { count: existing.count + 1, windowAt: existing.windowAt };

    rows.set(key, next);
    return [{ count: next.count }];
  });

  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });

  const prisma = {
    $queryRaw: queryRaw,
    rateLimit: { deleteMany },
  } as unknown as PrismaService;

  const service = new RateLimitService(prisma);

  // `hit` reads the clock with `new Date()`, which a `Date.now` spy does not
  // reach — hence the shared double rather than a one-line mock here.
  const clock = withClock(START);

  return { service, queryRaw, deleteMany, rows, clock };
}

const clocks: { restore: () => void }[] = [];
afterEach(() => {
  for (const clock of clocks.splice(0)) clock.restore();
  jest.restoreAllMocks();
});

/** Stands a service up and registers its clock for teardown. */
function setup(): ReturnType<typeof build> {
  const made = build();
  clocks.push(made.clock);
  return made;
}

describe('RateLimitService.hit', () => {
  it('allows exactly the limit and refuses the one after it', async () => {
    const { service } = setup();

    // Three allowed, because `count` includes the hit being counted — the
    // comparison is `<=`, and an off-by-one here is a whole extra attempt.
    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(true);
    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(true);
    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(true);
    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(false);
  });

  it('keeps counting past the limit, so hammering a locked key keeps it locked', async () => {
    const { service, rows } = setup();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await service.hit('scope', 'subject', LIMIT);
    }

    // The alternative — stop counting once refused — would let the window
    // drain under a steady stream of attempts and reopen on schedule.
    expect([...rows.values()][0]?.count).toBe(6);
  });

  it('opens a fresh window once the old one has closed', async () => {
    const { service, clock } = setup();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await service.hit('scope', 'subject', LIMIT);
    }
    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(false);

    clock.advance(LIMIT.windowMs + 1);

    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(true);
  });

  it('counts different subjects and different scopes separately', async () => {
    const { service, rows } = setup();

    await service.hit('scope-a', 'subject', LIMIT);
    await service.hit('scope-b', 'subject', LIMIT);
    await service.hit('scope-a', 'other', LIMIT);

    expect(rows.size).toBe(3);
  });

  it('stores a digest of the key and never the subject', async () => {
    const { service, queryRaw } = setup();

    await service.hit('auth:sign-in', 'vic@example.com', LIMIT);

    const [query] = queryRaw.mock.calls[0] ?? [];
    if (!query) throw new Error('the statement was never run');
    const [key] = query.values as [string];

    expect(key).toBe(
      createHash('sha256').update('auth:sign-in:vic@example.com').digest('hex'),
    );
    // The table must not become a list of addresses worth attacking.
    expect(JSON.stringify(query.values)).not.toContain('vic@example.com');
  });

  it('parameterises the subject rather than interpolating it', async () => {
    const { service, queryRaw } = setup();

    await service.hit('scope', "'; DROP TABLE rate_limits; --", LIMIT);

    const [query] = queryRaw.mock.calls[0] ?? [];
    if (!query) throw new Error('the statement was never run');
    // Prisma.sql keeps the text and the values apart. Nothing a caller
    // supplies reaches the statement text — and the hash means the value that
    // does travel is 64 hex characters whatever was passed in.
    expect(query.strings.join('')).not.toContain('DROP TABLE rate_limits');
  });

  it('allows the request when the database cannot be reached', async () => {
    const { service, queryRaw } = setup();
    queryRaw.mockRejectedValue(new Error('connection terminated'));

    // Fails open on purpose: the alternative is that a blip in Neon locks
    // every journalist out, and the guarded request is about to hit the same
    // database anyway and fail there with an honest message.
    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(true);
  });

  it('allows the request when the statement returns nothing', async () => {
    const { service, queryRaw } = setup();
    queryRaw.mockResolvedValue([]);

    await expect(service.hit('scope', 'subject', LIMIT)).resolves.toBe(true);
  });
});

describe('RateLimitService.clear', () => {
  it('deletes the row for that scope and subject only', async () => {
    const { service, deleteMany } = setup();

    await service.clear('auth:sign-in', 'vic@example.com');

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        key: createHash('sha256').update('auth:sign-in:vic@example.com').digest('hex'),
      },
    });
  });

  it('swallows a failure rather than turning a successful sign-in into a 500', async () => {
    const { service, deleteMany } = setup();
    deleteMany.mockRejectedValue(new Error('connection terminated'));

    await expect(service.clear('scope', 'subject')).resolves.toBeUndefined();
  });
});
