import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentPrincipal, type Principal } from '../../common/authz/principal';
import { NewsroomOnly, RequireScopes } from '../../common/authz/surface.decorator';
import { CreateAccountDto } from './account.dto';
import { AccountsService } from './accounts.service';
import { ActivityService } from './activity.service';
import { DiagnosticsService } from './diagnostics.service';

/**
 * The dev side of the newsroom.
 *
 * ── Why these live under `/newsroom` ─────────────────────────────────────
 * The same reason the catalog admin does: `/api/newsroom/:path*` is the
 * matcher the frontend's middleware and proxy already cover, and a route
 * outside it would be one the gate does not know about. The prefix describes
 * where the gate reaches, not who the route is for.
 *
 * ── Nothing here is `@PublicRead`, and nothing here can be ───────────────
 * A diagnostics report is a description of the deployment and an account list
 * is a list of the people who can sign in to it. Neither has a reader-facing
 * projection, so neither can be marked public even by mistake — there is no
 * view to name.
 */

@Controller('newsroom/diagnostics')
@NewsroomOnly()
@RequireScopes('system:diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get()
  read(@CurrentPrincipal() principal: Principal | undefined) {
    return this.diagnostics.read(principal);
  }
}

@Controller('newsroom/accounts')
@NewsroomOnly()
@RequireScopes('system:accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.accounts.list(principal);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.create(principal, dto, callerAddress(request));
  }

  /**
   * POST rather than GET, because it mints a credential and sends an email.
   * A GET that does either is a GET a link-prefetcher can fire.
   */
  @Post(':id/setup-link')
  issueLink(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.accounts.issueLink(principal, id, callerAddress(request));
  }
}

/**
 * Recorded on the reset row so a burst against one account is visible
 * afterwards. Not used to decide anything at the time — `x-forwarded-for` is
 * caller-supplied and would be a poor thing to authorise on.
 */
function callerAddress(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return first?.trim() || request.ip || null;
}

/**
 * Days the newsroom was opened, and the streak they make.
 *
 * ── Why this is not gated on a scope of its own ──────────────────────────
 * `newsroom:read`, which every account has. A scope exists to keep one
 * account out of another's business, and there is no business here to keep
 * anybody out of: both routes are about the *calling* principal and neither
 * can name another one. `ActivityService` takes the id from the principal
 * rather than from a parameter, so there is no shape of request that asks
 * about somebody else — which is a stronger guarantee than a scope, because a
 * scope can be granted and this cannot.
 */
@Controller('newsroom/activity')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  streak(@CurrentPrincipal() principal: Principal | undefined) {
    return this.activity.streak(principal);
  }

  /**
   * "I am here today."
   *
   * A POST because it writes, and idempotent because the row it writes is
   * keyed by (account, day) — so the shell can call it on every mount without
   * having to remember whether it already has.
   */
  @Post()
  record(@CurrentPrincipal() principal: Principal | undefined) {
    return this.activity.record(principal);
  }
}
