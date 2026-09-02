import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';

/**
 * Days the newsroom was opened, and the streak derived from them.
 *
 * ── What a streak is for here, and what it is not for ────────────────────
 * Writing is a habit before it is anything else, and the useful thing a tool
 * can say about a habit is "you have shown up seven days running". That is
 * the whole of it.
 *
 * It is deliberately not a target, a goal, a score or a comparison. There is
 * no daily word count to hit, nothing to "break" in red, and no notion of a
 * streak being lost — a streak that has ended is simply not the current one,
 * and the longest one still stands in the record. A newsroom tool that made a
 * journalist feel they had failed by taking a Sunday off would be optimising
 * for the tool.
 *
 * ── Everything is derived ────────────────────────────────────────────────
 * There is no stored counter. `WriterDay` rows are the days; the streak is
 * computed from them on every read. A counter would have to be advanced by
 * whatever code path happened to run, which is how two tabs open at midnight
 * become a double count — and once a counter is wrong the days it counted are
 * gone. Here a wrong answer is a query to fix.
 *
 * ── UTC, and why that is the honest choice rather than the easy one ──────
 * The day is a UTC date. The alternative is the writer's own zone, which
 * would need the browser to send it and would then be whatever zone the
 * device was in — so a trip changes the shape of history, and a day recorded
 * in Nairobi could be re-read in London as the day before. One zone, stated,
 * is wrong by a few hours at the edges for everybody; a floating zone is
 * wrong in a way nobody can reconstruct.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Records that this account opened the newsroom today.
   *
   * Idempotent by construction: the primary key is (user, day), so the tenth
   * page load of the afternoon is the same write as the first and two tabs
   * racing produce one row. `createMany` with `skipDuplicates` rather than an
   * upsert because there is nothing to update — the row's existence *is* the
   * fact.
   */
  async record(principal: Principal | undefined): Promise<{ day: string }> {
    const me = this.policy.requireScope(principal, 'newsroom:read');
    const day = today();

    await this.prisma.writerDay.createMany({
      data: [{ userId: me.id, day }],
      skipDuplicates: true,
    });

    return { day };
  }

  /**
   * The streak, the longest one, and the days behind both.
   *
   * The raw days travel too, because a number with no working is a number a
   * person has to trust. Bounded to the last year, which is both plenty for
   * any display and a cap on what this can ever return.
   */
  async streak(principal: Principal | undefined): Promise<{
    current: number;
    longest: number;
    activeToday: boolean;
    lastActiveOn: string | null;
    days: string[];
  }> {
    const me = this.policy.requireScope(principal, 'newsroom:read');

    const rows = await this.prisma.writerDay.findMany({
      where: { userId: me.id, day: { gte: daysAgo(365) } },
      orderBy: { day: 'desc' },
      select: { day: true },
    });

    const days = rows.map((row) => row.day);
    return {
      ...streakFrom(days),
      activeToday: days[0] === today(),
      lastActiveOn: days[0] ?? null,
      days,
    };
  }
}

/* ── The arithmetic, as free functions so it can be reasoned about ────────
 *
 * Out of the class deliberately: none of it touches the database or the
 * policy, all of it is a pure function of a list of date strings, and that is
 * the part most worth being able to read in one go.
 */

/** Today, as the UTC date. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The UTC date `n` days before today. */
export function daysAgo(n: number): string {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() - n);
  return at.toISOString().slice(0, 10);
}

/** Whole days between two `YYYY-MM-DD` dates. Positive when `later` is later. */
export function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00.000Z`);
  const b = Date.parse(`${later}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * The current and longest runs of consecutive days.
 *
 * ── Why today's absence does not end the streak ──────────────────────────
 * A streak counts as current if its most recent day is today *or yesterday*.
 * Without that, opening the app at nine in the morning would show a streak of
 * one, because "yesterday" is not "today" — the count would collapse every
 * midnight and only recover once the writer had visited. Reading a streak
 * before you have done today's work is the ordinary case, and it should show
 * what you have built rather than punish you for the hour.
 *
 * Anything older than yesterday is a run that has ended. It is reported as
 * zero current, and it is still in `longest`, which is the point of keeping
 * both.
 */
export function streakFrom(daysDescending: readonly string[]): {
  current: number;
  longest: number;
} {
  if (daysDescending.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;

  for (let i = 1; i < daysDescending.length; i += 1) {
    const gap = daysBetween(daysDescending[i]!, daysDescending[i - 1]!);
    // Duplicates cannot occur — the primary key forbids them — but a gap of
    // zero is treated as no break rather than as a new run, so this stays
    // correct if the source of days ever stops being that table.
    if (gap <= 1) {
      run += gap === 1 ? 1 : 0;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);

  const newest = daysDescending[0]!;
  const sinceNewest = daysBetween(newest, today());
  if (sinceNewest > 1) return { current: 0, longest };

  // The current run is the leading one, recomputed from the top so a gap
  // further back cannot leak into it.
  let current = 1;
  for (let i = 1; i < daysDescending.length; i += 1) {
    if (daysBetween(daysDescending[i]!, daysDescending[i - 1]!) === 1) current += 1;
    else break;
  }

  return { current, longest };
}
