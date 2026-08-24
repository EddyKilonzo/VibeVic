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
   * Connect at boot rather than lazily on the first query.
   *
   * The catch is not decoration. An unreachable database otherwise surfaces as
   * a Prisma stack trace during startup, which buries the one fact that
   * matters — the URL is wrong, or the Neon project is suspended — under a
   * driver trace nobody reads. The original still goes to the log; what is
   * added is the sentence saying what to go and check.
   *
   * It rethrows. A server that starts without a database is a server that
   * answers every request with a 500, and failing to boot is the honest
   * version of that.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (cause) {
      this.logger.error(
        'Could not connect to the database. Check DATABASE_URL in backend/.env, ' +
          'and that the Neon project is awake and reachable from this network.',
        cause instanceof Error ? cause.stack : String(cause),
      );
      throw cause;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
