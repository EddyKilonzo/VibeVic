import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { DiagnosticsService } from './diagnostics.service';
import { AccountsController, DiagnosticsController } from './system.controller';

/**
 * The two capabilities the DEV role holds and the WRITER role does not.
 *
 * Grouped in one module because they are one job — keeping the thing running
 * and keeping the people who run it able to sign in — and because a module
 * per controller would put the split across four files that only ever change
 * together.
 */
@Module({
  controllers: [DiagnosticsController, AccountsController],
  providers: [DiagnosticsService, AccountsService],
})
export class SystemModule {}
