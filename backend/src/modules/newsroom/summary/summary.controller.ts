import { Controller, Get } from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../../common/authz/principal';
import { NewsroomOnly, RequireScopes } from '../../../common/authz/surface.decorator';
import { SummaryService } from './summary.service';

/**
 * Counts only. Read-only by construction — there is nothing here to write to,
 * and the numbers are derived, so there is no version token and no PATCH.
 */
@Controller('newsroom/summary')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get()
  counts(@CurrentPrincipal() principal: Principal | undefined) {
    return this.summary.counts(principal);
  }
}
