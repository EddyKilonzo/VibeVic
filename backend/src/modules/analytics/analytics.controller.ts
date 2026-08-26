import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../common/authz/principal';
import {
  NewsroomOnly,
  PublicRead,
  RequireScopes,
} from '../../common/authz/surface.decorator';
import { EventAckPublicView, type PublicEventAck } from '../../common/serialization/views';
import { RecordEventDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

/**
 * The one unauthenticated write in the API.
 *
 * ── Why it is allowed to be public at all ────────────────────────────────
 * Readers have no accounts and never will on this site, so a credential is not
 * available and requiring one would mean counting nothing. What makes it safe
 * is the shape of what it can do: it can add at most one narrow row per story
 * per session per day, it can only name a story that is already published, and
 * it returns a fixed boolean regardless of outcome. There is nothing to read
 * back and nothing to accumulate beyond a count.
 *
 * ── What it deliberately does not accept ─────────────────────────────────
 * No referrer, no user agent echoed from the client, no screen size, no
 * timestamp. The server stamps the time itself, and the only client-supplied
 * identifier is a random per-tab string that is never read back out. That is
 * the difference between counting reading and profiling readers, and it is the
 * line this site has to keep on the right side of.
 */
@Controller('stories/:slug/events')
export class ReaderEventsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * The user agent is read from the header rather than the body.
   *
   * A client that could tell the server what it is could tell it something
   * else. This is the one the connection actually carried, which is all the bot
   * filter has any business trusting.
   */
  @Post()
  @PublicRead(EventAckPublicView)
  async record(
    @Param('slug') slug: string,
    @Body() dto: RecordEventDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<PublicEventAck> {
    await this.analytics.record(slug, dto, userAgent);

    // Always the same answer. Whether it was counted, absorbed as a repeat or
    // dropped as a crawler is not something the caller gets to learn — see
    // `EventAckPublicView`.
    return { accepted: true };
  }
}

/**
 * The numbers, behind the gate.
 *
 * Reading is authenticated even though writing is not, and that asymmetry is
 * the point: anyone may contribute a count, only the newsroom may see the
 * totals. Exposing them publicly would let anybody watch how a piece is
 * travelling, which is the journalist's business and nobody else's.
 */
@Controller('newsroom/analytics')
@NewsroomOnly()
@RequireScopes('stories:write')
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  summary(@CurrentPrincipal() principal: Principal | undefined) {
    return this.analytics.summary(principal);
  }

  /**
   * Recomputes every aggregate from the event ledger.
   *
   * POST because it writes, and manual because it should be: the aggregate is
   * kept correct on every event, so needing this means something has already
   * gone wrong and a person should be the one deciding to run it.
   */
  @Post('rebuild')
  rebuild(@CurrentPrincipal() principal: Principal | undefined) {
    return this.analytics.rebuild(principal);
  }
}
