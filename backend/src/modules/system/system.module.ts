import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { ActivityService } from './activity.service';
import { DiagnosticsService } from './diagnostics.service';
import {
  AccountsController,
  ActivityController,
  DiagnosticsController,
} from './system.controller';

/**
 * The two capabilities the DEV role holds and the WRITER role does not — plus
 * one that belongs to whoever is asking.
 *
 * Diagnostics and accounts are grouped because they are one job: keeping the
 * thing running and keeping the people who run it able to sign in. A module
 * per controller would put that split across four files that only ever change
 * together.
 *
 * Activity sits here for a weaker reason and it is worth being honest about
 * it: it is about the deployment's own users rather than about the newsroom's
 * records, so it is not a newsroom collection — and a module holding one
 * service and one controller would be three files of ceremony. If a second
 * per-account thing ever appears, the two of them should leave together.
 */
@Module({
  controllers: [DiagnosticsController, AccountsController, ActivityController],
  providers: [DiagnosticsService, AccountsService, ActivityService],
})
export class SystemModule {}
