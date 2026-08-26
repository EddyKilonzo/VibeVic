import { Module } from '@nestjs/common';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import { AnalyticsAdminController, ReaderEventsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Reader analytics: one public write, one gated read.
 *
 * The two controllers live in one module because they are two ends of the same
 * ledger, and keeping them together is what makes the asymmetry visible — a
 * reader may add to it, only the newsroom may read it.
 */
@Module({
  controllers: [ReaderEventsController, AnalyticsAdminController],
  providers: [AnalyticsService, AccessPolicyService],
})
export class AnalyticsModule {}
