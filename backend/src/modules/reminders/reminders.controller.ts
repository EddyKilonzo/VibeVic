import { Controller, Post } from '@nestjs/common';
import { MachineOnly } from '../../common/authz/surface.decorator';
import { RemindersService } from './reminders.service';

/**
 * The endpoint a scheduler calls once a morning.
 *
 * ── Why it is a POST that takes nothing ──────────────────────────────────
 * It has effects — it sends mail and moves a status column — so it is not a
 * GET, whatever the convenience of being able to visit it in a browser. And
 * it takes no body because there is nothing for a caller to decide: which
 * writers, which deadlines and how long counts as "away" are the product's
 * questions, not the scheduler's. A cron that could pass parameters would be
 * a second place those answers live.
 *
 * ── What it returns ──────────────────────────────────────────────────────
 * Counts, so a scheduler's own log says what happened. Deliberately not the
 * addresses or the deadlines: a cron log is somewhere those would sit in
 * plain text on somebody else's platform, and "two notices went out" is the
 * whole of what the caller needs to know.
 *
 * ── @MachineOnly, and what that does not grant ───────────────────────────
 * No principal is built for this request, so nothing behind it can ask "may
 * I" and nothing can act as a person. Whoever holds \`CRON_SECRET\` can cause
 * the newsroom to email its own writers what it already knows; they cannot
 * read a source, open a draft, or reach any other route. That bound is the
 * reason this is a surface rather than a service account.
 */
@Controller('system/reminders')
@MachineOnly()
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post('run')
  run() {
    return this.reminders.run();
  }
}
