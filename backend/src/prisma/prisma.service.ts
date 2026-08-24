import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
