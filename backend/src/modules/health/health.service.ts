import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublicHealth } from '../../common/serialization/views';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reports "degraded" rather than throwing when the database is unreachable,
   * so a load balancer gets an answer it can act on. The reason for the
   * degradation is logged, never returned: an error string from the database
   * driver on an unauthenticated endpoint is free reconnaissance.
   */
  async check(): Promise<PublicHealth> {
    let status: PublicHealth['status'] = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      status = 'degraded';
      this.logger.error(
        `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }
}
