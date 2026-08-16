import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
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
  constructor() {
    super({ log: ['warn', 'error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
