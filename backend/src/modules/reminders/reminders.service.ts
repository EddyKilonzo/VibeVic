import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { awayEmail } from '../mail/templates/away';
import { deadlinesEmail, type DueItem } from '../mail/templates/deadlines';
import { daysBetween, today } from '../system/activity.service';

/**
 * The mail the newsroom sends without being asked.
 *
 * ── Why this is one pass and not three schedules ─────────────────────────
 * Every message here is answering the same question — "is there anything the
 * writer would want to know this morning" — against the same rows, and
 * splitting it into a deadlines job, an away job and a published job would be
 * three things to schedule, three things to forget to schedule, and three
 * chances for a deployment to be running two of them.
 *
 * ── Why it is triggered rather than timed ────────────────────────────────
 * There is no timer in this process. A `setInterval` in a Nest service is
 * per-instance, so a deployment behind two instances sends every reminder
 * twice, and a restart resets whatever it was counting. An endpoint called by
 * something whose job is scheduling — a platform cron, a scheduler service —
 * is called once, and the one thing that can go wrong (nothing calls it) is
 * visible as "no email arrived" rather than as "two arrived".
 *
 * The same reasoning appears in `StoriesService.publish`, which reaches the
 * opposite conclusion for a different reason and it is worth being clear why.
 * Publishing must not depend on a job at all, because a piece that goes live
 * late is a broken promise to a reader. A reminder that arrives late is a
 * late reminder — annoying, not wrong — so a schedule is an acceptable owner
 * for this and not for that.
 *
 * ── Idempotence, which the trigger cannot be trusted to provide ──────────
 * Cron delivery is at-least-once everywhere it exists. Two calls in one
 * morning must not mean two emails, so every send here is gated on a stored
 * fact that the send itself moves: an away notice writes `awayNoticeAt`, and
 * the deadline digest is bounded to what is genuinely outstanding, which does
 * not change between two calls a minute apart. The digest can therefore
 * double if it is triggered twice in a day — accepted, because the alternative
 * is a "last sent" column whose only reader is a guard against a
 * misconfiguration, and because a cron that fires twice daily is a
 * configuration error that should be visible rather than absorbed.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** How far ahead a deadline has to be before it stops being "coming up". */
  private static readonly HORIZON_DAYS = 3;

  /** Silence this long before the newsroom says anything about it. */
  private static readonly AWAY_DAYS = 7;

  /** And this long before it is willing to say it a second time. */
  private static readonly AWAY_REPEAT_DAYS = 30;

  async run(): Promise<{
    promoted: number;
    deadlineNotices: number;
    awayNotices: number;
    skipped?: string;
  }> {
    // Housekeeping first, and it runs whether or not mail is configured: a
    // scheduled piece whose moment has passed should have the status column
    // to match, and that is true of a deployment with no mailer at all.
    const promoted = await this.promoteDueScheduled();

    if (!this.mail.configured) {
      // Not an error. A deployment without SMTP is a legitimate state — the
      // mail service says so — and the honest report is that the pass ran and
      // sent nothing, rather than a failure that would page somebody.
      this.logger.log('Reminders ran; no mailer is configured, so nothing was sent.');
      return { promoted, deadlineNotices: 0, awayNotices: 0, skipped: 'no mailer configured' };
    }

    const writers = await this.prisma.user.findMany({
      // Writers only. A dev account has no deadlines of its own and is not the
      // person whose habit this is about — and `newsroom:ideas` is withheld
      // from it precisely so it is not told what Victor is working on.
      where: { role: Role.WRITER },
      select: { id: true, email: true, name: true, awayNoticeAt: true },
    });

    let deadlineNotices = 0;
    let awayNotices = 0;

    for (const writer of writers) {
      // Each writer independently: one failed send must not stop the next
      // person's mail. The mail service already logs the relay's own words.
      try {
        if (await this.sendDeadlines(writer)) deadlineNotices += 1;
      } catch (cause) {
        this.logger.error(`Deadline notice for ${writer.email} failed.`, cause);
      }

      try {
        if (await this.sendAwayNotice(writer)) awayNotices += 1;
      } catch (cause) {
        this.logger.error(`Away notice for ${writer.email} failed.`, cause);
      }
    }

    return { promoted, deadlineNotices, awayNotices };
  }

  /* ── Deadlines ───────────────────────────────────────────────────────── */

  private async sendDeadlines(writer: { email: string; name: string }): Promise<boolean> {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + RemindersService.HORIZON_DAYS);

    const deadlines = await this.prisma.deadline.findMany({
      where: { done: false, dueAt: { lte: horizon } },
      orderBy: { dueAt: 'asc' },
      include: { story: { select: { title: true } } },
      // A bound rather than a page. Nobody reads the fortieth line of a
      // reminder, and a digest that could grow without limit is one that
      // eventually cannot be sent at all.
      take: 25,
    });

    // Nothing outstanding, nothing sent. A daily "all clear" is the message
    // that teaches its reader to filter the sender — and then the one that
    // mattered is filtered too.
    if (deadlines.length === 0) return false;

    const now = new Date();
    const items: DueItem[] = deadlines.map((deadline) => ({
      label: deadline.label,
      when: deadline.dueAt.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
      story: deadline.story?.title,
      overdue: deadline.dueAt < now,
    }));

    await this.mail.send(
      deadlinesEmail({
        to: writer.email,
        name: writer.name,
        items,
        newsroomUrl: this.newsroomUrl(),
      }),
    );

    return true;
  }

  /* ── Being away ──────────────────────────────────────────────────────── */

  private async sendAwayNotice(writer: {
    id: string;
    email: string;
    name: string;
    awayNoticeAt: Date | null;
  }): Promise<boolean> {
    const days = await this.prisma.writerDay.findMany({
      where: { userId: writer.id },
      orderBy: { day: 'desc' },
      select: { day: true },
      take: 400,
    });

    // No recorded days at all. That is a new account, not an absent writer,
    // and telling somebody who has never signed in that they have been away
    // would be both wrong and the first thing the product ever said to them.
    const lastActive = days[0]?.day;
    if (!lastActive) return false;

    const since = daysBetween(lastActive, today());
    if (since < RemindersService.AWAY_DAYS) return false;

    // Said once. `awayNoticeAt` is what keeps this from becoming a drip, and
    // the window is a month rather than "ever" so a genuinely long absence is
    // acknowledged again eventually rather than silently never.
    if (
      writer.awayNoticeAt &&
      Date.now() - writer.awayNoticeAt.getTime() <
        RemindersService.AWAY_REPEAT_DAYS * 86_400_000
    ) {
      return false;
    }

    // The piece that was open, by name — the one genuinely useful thing this
    // email can carry. Most recently touched draft, because that is what "the
    // one I was working on" means in practice.
    const draft = await this.prisma.story.findFirst({
      where: { status: StoryStatus.DRAFT },
      orderBy: { updatedAt: 'desc' },
      select: { title: true },
    });

    await this.mail.send(
      awayEmail({
        to: writer.email,
        name: writer.name,
        days: since,
        longestStreak: longestRun(days.map((row) => row.day)),
        openDraft: draft?.title,
        newsroomUrl: this.newsroomUrl(),
      }),
    );

    // After the send, never before: a stamp written first would silence the
    // next month's notice on the strength of an email that failed to go.
    await this.prisma.user.update({
      where: { id: writer.id },
      data: { awayNoticeAt: new Date() },
    });

    return true;
  }

  /* ── Housekeeping ────────────────────────────────────────────────────── */

  /**
   * The same tidy-up `StoriesService` does on the admin list, run on a
   * schedule as well so the status column is right even on a deployment
   * nobody has opened the admin on today.
   *
   * Still not what makes a scheduled piece public — `publishedWhere` does that
   * from the clock. This only stops the admin list from calling a live piece
   * "scheduled".
   */
  private async promoteDueScheduled(): Promise<number> {
    const { count } = await this.prisma.story.updateMany({
      where: { status: StoryStatus.SCHEDULED, publishedAt: { not: null, lte: new Date() } },
      data: { status: StoryStatus.PUBLISHED },
    });
    return count;
  }

  /** APP_URL without its trailing slash, or a bare path if it is not set. */
  private newsroomUrl(): string {
    const origin = (this.config.get('APP_URL', { infer: true }) ?? '').replace(/\/+$/, '');
    return origin ? `${origin}/admin` : '/admin';
  }
}

/**
 * The longest run of consecutive days in a descending list of dates.
 *
 * A second copy of arithmetic `ActivityService` also does, and deliberately
 * not shared with it: that one answers a request from a signed-in principal
 * and returns both runs; this one needs a single number from a list it has
 * already fetched for another reason. Importing the whole service to reach a
 * private branch of it would couple a mail pass to an HTTP-facing service for
 * one loop.
 */
function longestRun(daysDescending: readonly string[]): number {
  if (daysDescending.length === 0) return 0;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < daysDescending.length; i += 1) {
    if (daysBetween(daysDescending[i]!, daysDescending[i - 1]!) === 1) run += 1;
    else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  return Math.max(longest, run);
}
