import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prisma client with the Nest lifecycle wired up.
 *
 * Query logging is left off deliberately. Newsroom queries carry source names
 * and quote text in their parameters, so a log line is an unencrypted copy of
 * confidential material in whatever aggregator the logs end up in. If query
 * logging is ever wanted, it needs a redaction step first.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: ['warn', 'error'] });
    this.$use(retryOnDroppedConnection(this.logger));
  }

  /**
   * Connect at boot, retrying while the database wakes.
   *
   * Neon suspends an idle project and takes a few seconds to come back, and the
   * first connection attempt against a suspended instance times out rather than
   * waiting. Without the retry the API simply refuses to start — which is the
   * correct response to a genuinely unreachable database and the wrong one to a
   * database that is merely asleep and about to answer.
   *
   * So: a handful of attempts with a widening gap, then give up. It still
   * refuses to boot in the end, because a server that starts without a database
   * answers every request with a 500 and failing loudly is the honest version
   * of that. What changes is that the ordinary case — nobody has touched the
   * site since yesterday — is a slow start rather than a dead one.
   */
  async onModuleInit(): Promise<void> {
    const attempts = 5;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Database connected on attempt ${attempt}.`);
        }
        return;
      } catch (cause) {
        const last = attempt === attempts;
        if (last) {
          this.logger.error(
            'Could not connect to the database after ' +
              `${attempts} attempts. Check DATABASE_URL in backend/.env, and ` +
              'that the Neon project exists and is reachable from this network.',
            cause instanceof Error ? cause.stack : String(cause),
          );
          throw cause;
        }

        // 1s, 2s, 4s, 8s — long enough in total to cover a cold start, short
        // enough that a genuinely wrong URL still fails within about fifteen
        // seconds rather than hanging a deploy.
        const waitMs = 1000 * 2 ** (attempt - 1);
        this.logger.warn(
          `Database not reachable (attempt ${attempt}/${attempts}); ` +
            `retrying in ${waitMs}ms. It may be waking up.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Prisma error codes that mean the query never reached the database.
 *
 *  - P1001 the server could not be reached at all
 *  - P1002 the connection timed out
 *  - P1017 the server closed the connection
 *  - P2024 no connection could be taken from the pool in time
 *
 * The distinction that makes a retry safe is that all four are raised *before*
 * a statement executes. Retrying a write that may have run is how one idea gets
 * filed twice; retrying one that provably did not is how a serverless database
 * waking up stops being an outage.
 */
const NEVER_EXECUTED = new Set(['P1001', 'P1002', 'P1017', 'P2024']);

/** Neon closing an idle socket, which arrives without a Prisma error code. */
const DROPPED = /kind: Closed|Can't reach database server|Connection reset|ECONNRESET/i;

function isDroppedConnection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && NEVER_EXECUTED.has(code)) return true;
  const message = error instanceof Error ? error.message : '';
  return DROPPED.test(message);
}

/**
 * One retry, for the failure that happens every morning.
 *
 * ── The problem ──────────────────────────────────────────────────────────
 * `onModuleInit` retries while the database wakes, which covers a cold boot.
 * It does nothing for the far more common case: the server has been up for
 * hours, Neon has suspended the compute behind an idle connection, and the
 * next request — the first one somebody makes after lunch — fails with
 * "Can't reach database server" while the instance spins back up. The user sees
 * a 500 on a healthy system, refreshes, and it works. That is not an outage
 * worth reporting and it should not be one worth showing.
 *
 * ── Why only these errors, and why the budget is small ───────────────────
 * A retry loop around a database is a way to turn a five-second failure into a
 * thirty-second one and to double-apply writes while doing it. This retries
 * only for errors raised before a statement executes, and lets everything else
 * — a unique-constraint violation, a foreign key, a genuine timeout mid-query —
 * through untouched. A query that may have run is never sent again.
 *
 * ── Why three attempts and not one ───────────────────────────────────────
 * One covers a dropped socket, which reconnects immediately. It does not cover
 * the case this was written for: a suspended Neon compute takes several seconds
 * to come back, and a single retry 250ms later just fails a second time. The
 * gaps widen — 300ms, 1.2s, 4s — so a socket that only needs reopening costs
 * almost nothing, and a compute that is genuinely waking gets the time it
 * needs. Total worst case is about five and a half seconds, which is inside the
 * fifteen the callers allow themselves and well short of turning a slow request
 * into a hung one.
 */
const BACKOFF_MS = [300, 1_200, 4_000];

function retryOnDroppedConnection(logger: Logger): Prisma.Middleware {
  return async (params, next) => {
    const what = `${params.model ?? 'raw'}.${params.action}`;

    for (let attempt = 0; ; attempt += 1) {
      try {
        const result = await next(params);
        if (attempt > 0) logger.log(`${what} succeeded on attempt ${attempt + 1}.`);
        return result;
      } catch (error) {
        if (!isDroppedConnection(error) || attempt >= BACKOFF_MS.length) throw error;

        const waitMs = BACKOFF_MS[attempt];
        logger.warn(
          `Connection dropped before ${what} ran (attempt ${attempt + 1}/` +
            `${BACKOFF_MS.length + 1}); retrying in ${waitMs}ms. The database may be waking.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  };
}
