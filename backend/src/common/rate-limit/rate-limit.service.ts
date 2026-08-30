import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Counting attempts, in a place every instance can see.
 *
 * ── What this replaced ───────────────────────────────────────────────────
 * Two `Map`s, one in `AuthService` and one in `PasswordResetService`, each in
 * its own process. Both carried an honest comment saying a second instance
 * meant a second full allowance and a restart cleared the count — which is
 * the correct description of a speed bump, and the wrong property for the
 * only thing standing between a wordlist and somebody's account.
 *
 * ── Why raw SQL ──────────────────────────────────────────────────────────
 * Read-then-write is the bug this exists to avoid. Two requests arriving
 * together both read `count: 7`, both write `8`, and the allowance is one
 * larger than it says — which is not a disaster at eight, and is a disaster
 * at whatever concurrency an attacker chooses. `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` is one statement: Postgres serialises the conflicting
 * writers on the row, and each caller gets back the count its own hit
 * produced. There is no Prisma expression for that — `upsert` is two
 * statements in a trench coat — so this is the one place in the codebase that
 * writes SQL by hand, and it is parameterised throughout.
 *
 * ── The window ───────────────────────────────────────────────────────────
 * Fixed, not sliding. A hit lands in the window that is open; if the open one
 * started longer ago than `windowMs`, the same statement resets the row to a
 * fresh window of one. Fixed windows let a caller spend the tail of one
 * window and the head of the next back to back — twice the limit across the
 * boundary, in the worst case. A sliding window costs a second table of
 * timestamps to fix a factor of two, and a factor of two does not change
 * whether a wordlist is viable.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Count one attempt, and say whether it is allowed.
   *
   * `true` means "under the limit, carry on". The hit is recorded either way:
   * a caller that is already over the line still counts, so hammering a
   * throttled key keeps it throttled rather than letting the window drain
   * while the attempts continue.
   *
   * ── Fails open, deliberately ─────────────────────────────────────────────
   * A database that cannot be reached returns `true`. That is the
   * uncomfortable choice and it is the right one here: the alternative is
   * that a blip in Neon locks every journalist out of the newsroom, and the
   * request this guards is about to hit the same database anyway — it will
   * fail there, on its own merits, with a message about the database rather
   * than a lie about too many attempts. A limiter that takes the whole
   * application down with it when it breaks is a limiter that gets removed.
   */
  async hit(
    scope: string,
    subject: string,
    options: { limit: number; windowMs: number },
  ): Promise<boolean> {
    const key = bucketKey(scope, subject);
    const now = new Date();
    const windowOpenedAfter = new Date(now.getTime() - options.windowMs);

    try {
      const rows = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        INSERT INTO "rate_limits" ("key", "count", "windowAt", "updatedAt")
        VALUES (${key}, 1, ${now}, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "rate_limits"."windowAt" <= ${windowOpenedAfter} THEN 1
            ELSE "rate_limits"."count" + 1
          END,
          "windowAt" = CASE
            WHEN "rate_limits"."windowAt" <= ${windowOpenedAfter} THEN ${now}
            ELSE "rate_limits"."windowAt"
          END,
          "updatedAt" = ${now}
        RETURNING "count"
      `);

      const count = rows[0]?.count;
      if (count === undefined) {
        // `RETURNING` on a statement that wrote a row cannot be empty. If it
        // is, something is wrong that this class should not paper over.
        this.logger.error(`Rate-limit statement returned no row for scope ${scope}.`);
        return true;
      }

      this.sweepOccasionally();
      return count <= options.limit;
    } catch (cause) {
      this.logger.error(`Rate-limit check failed for scope ${scope}; allowing.`, cause);
      return true;
    }
  }

  /**
   * Forget a key. Called after a success, so the count a person built up
   * getting their own password wrong does not follow them into the evening.
   *
   * Failures are logged and swallowed: leaving a stale row costs one wasted
   * allowance, and turning a successful sign-in into a 500 because a delete
   * failed costs the sign-in.
   */
  async clear(scope: string, subject: string): Promise<void> {
    try {
      await this.prisma.rateLimit.deleteMany({ where: { key: bucketKey(scope, subject) } });
    } catch (cause) {
      this.logger.warn(`Could not clear rate-limit key for scope ${scope}.`, cause);
    }
  }

  /**
   * Clears out rows nobody will read again.
   *
   * Every distinct address anyone tries writes a row, so an attack against a
   * wordlist of ten thousand addresses leaves ten thousand rows behind. They
   * are harmless — the key is a digest and the window is long dead — but
   * unbounded growth of a table nobody prunes is how a small database becomes
   * a bill.
   *
   * One in every hundred hits, and not awaited. A cron would be tidier, and
   * would also mean a scheduler package, a second thing to configure, and a
   * job that does not run on the instance that noticed. This costs nothing on
   * ninety-nine calls out of a hundred and runs somewhere, eventually, which
   * is the whole requirement.
   */
  private sweepOccasionally(): void {
    if (Math.random() >= 0.01) return;

    const before = new Date(Date.now() - SWEEP_AFTER_MS);
    void this.prisma.rateLimit
      .deleteMany({ where: { updatedAt: { lt: before } } })
      .then(({ count }) => {
        if (count > 0) this.logger.log(`Swept ${count} expired rate-limit rows.`);
      })
      .catch((cause: unknown) => {
        this.logger.warn('Rate-limit sweep failed.', cause);
      });
  }
}

/** Rows older than a day are past every window this codebase configures. */
const SWEEP_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * The bucket name for a subject, which never stores the subject.
 *
 * Scoped so the two throttles cannot collide: a failed sign-in for an address
 * and a reset request for the same address are different questions with
 * different limits, and one key would let a person lock themselves out of one
 * by exercising the other.
 */
function bucketKey(scope: string, subject: string): string {
  return createHash('sha256').update(`${scope}:${subject}`).digest('hex');
}
