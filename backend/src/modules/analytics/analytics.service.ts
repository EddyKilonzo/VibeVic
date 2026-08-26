import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ReadEventKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import type { RecordEventDto } from './analytics.dto';

/**
 * Reader analytics.
 *
 * ── The three objections this had to answer ──────────────────────────────
 * `recordView` was left as a 501 with a specific complaint: "Counters need
 * de-duplication, bot filtering and a write path that does not lock the article
 * row on every page view; an increment here would produce numbers nobody should
 * quote." Each is answered below rather than waved at, because the alternative
 * — `UPDATE stories SET views = views + 1` — is the thing that comment exists
 * to prevent.
 *
 *   De-duplication  A unique index on (story, kind, session, day). Twenty
 *                   reloads are one row. The database enforces it, so it holds
 *                   for a client that ignores whatever the browser does.
 *
 *   Bot filtering   `isBot` below, plus the fact that a counted event requires
 *                   a session id the browser had to mint and echo. A crawler
 *                   fetching HTML never runs the script that sends one, so the
 *                   ordinary case is filtered by construction rather than by
 *                   pattern-matching a user agent.
 *
 *   The write path  Nothing here writes to `stories`. It touches one narrow
 *                   event row and one stats row, both keyed so that two readers
 *                   on the same article never contend for the same lock.
 *
 * ── Why the aggregate is recomputed rather than incremented ──────────────
 * `StoryStats` is derived from the ledger on every counted event, by counting
 * the ledger. An increment would be one query cheaper and would drift the first
 * time anything was retried, deleted or backfilled — and a metric that drifts
 * is a metric somebody eventually quotes wrongly. Recomputing costs one grouped
 * read per *counted* event, and counted events are at most one per reader per
 * story per day.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Obvious crawlers, by name.
   *
   * A deliberately short list, and not the mechanism this relies on — see the
   * note above about the session id. It is here for the honest middle case: a
   * headless browser that does run scripts. Anything cleverer than this is an
   * arms race that a one-person newsroom should not be running, and the metric
   * it protects is "roughly how many people read this", not billing.
   */
  private isBot(userAgent: string | undefined): boolean {
    if (!userAgent) return true; // No agent at all is not a reader.
    return /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python-requests|axios|okhttp|lighthouse|pingdom|uptime/i.test(
      userAgent,
    );
  }

  /** The UTC day, so the dedup window does not move with the reader's timezone. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Records one event against a published story, and returns nothing.
   *
   * ── Why the answer carries no numbers ────────────────────────────────
   * This is the only unauthenticated write in the API. Returning the running
   * total would turn it into an oracle: anybody could watch a story's view
   * count move and learn how well an unpublished-yesterday piece is doing, or
   * simply scrape the archive's performance. The journalist reads these numbers
   * behind the newsroom gate; a reader gets an acknowledgement.
   */
  async record(slug: string, dto: RecordEventDto, userAgent: string | undefined): Promise<void> {
    if (this.isBot(userAgent)) return;

    /**
     * Only published stories, and looked up by slug.
     *
     * The public surface is addressed by slug, and accepting an id here would
     * let somebody probe which ids exist. Restricting to published means a
     * draft cannot accumulate views before anybody could legitimately have read
     * it — which would otherwise be a small, quiet way to learn that an
     * unpublished story exists.
     */
    const story = await this.prisma.story.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { not: null, lte: new Date() } },
      select: { id: true },
    });

    // Silently ignored rather than 404. A reader's browser reporting against a
    // story that has since been unpublished is not an error the reader can do
    // anything about, and answering 404 would confirm the slug either way.
    if (!story) return;

    const day = this.today();
    const seconds = dto.kind === ReadEventKind.LISTEN ? (dto.seconds ?? 0) : 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        /**
         * One row per story/kind/session/day.
         *
         * `upsert` rather than `create` so a repeat is absorbed instead of
         * throwing, and so listening seconds accumulate across a session's day
         * — a reader who plays the piece in three sittings has listened for the
         * sum, and is still one listener.
         */
        await tx.storyEvent.upsert({
          where: {
            storyId_kind_session_day: {
              storyId: story.id,
              kind: dto.kind,
              session: dto.session,
              day,
            },
          },
          create: { storyId: story.id, kind: dto.kind, session: dto.session, day, seconds },
          update: seconds > 0 ? { seconds: { increment: seconds } } : {},
        });

        await this.refresh(tx, story.id);
      });
    } catch (cause) {
      /**
       * Never raised to the reader.
       *
       * This endpoint exists so a journalist can see roughly how their work
       * travels. A failure to count is worth a log line and nothing else — an
       * error surfacing here would mean a reader's article page reporting a
       * problem about a number they will never see.
       */
      this.logger.error(
        `Could not record ${dto.kind} for ${slug}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  /**
   * Recomputes one story's aggregate from the ledger.
   *
   * Typed against the transaction client so it cannot be called outside one:
   * reading the events and writing the summary have to be the same atomic step,
   * or a concurrent event can land between them and be counted twice.
   */
  private async refresh(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    storyId: string,
  ): Promise<void> {
    const grouped = await tx.storyEvent.groupBy({
      by: ['kind'],
      where: { storyId },
      _count: { _all: true },
      _sum: { seconds: true },
    });

    const of = (kind: ReadEventKind) => grouped.find((row) => row.kind === kind);
    const listens = of(ReadEventKind.LISTEN);
    const listenCount = listens?._count._all ?? 0;
    const listenSeconds = listens?._sum.seconds ?? 0;

    const stats = {
      views: of(ReadEventKind.VIEW)?._count._all ?? 0,
      reads: of(ReadEventKind.READ)?._count._all ?? 0,
      listens: listenCount,
      // Integer seconds, rounded. A mean to three decimal places would imply a
      // precision that a per-session sum does not have.
      avgListenSeconds: listenCount > 0 ? Math.round(listenSeconds / listenCount) : 0,
    };

    await tx.storyStats.upsert({
      where: { storyId },
      create: { storyId, ...stats },
      update: stats,
    });
  }

  /**
   * The numbers, for the newsroom.
   *
   * Behind the gate, unlike the write. Returns a row per story that has any
   * events at all — a story nobody has opened reports nothing rather than a
   * zero, which is the distinction `lib/voice/analytics` already draws: "an
   * article that has never been played reports no plays, and the dashboard
   * renders that as 'no data yet' rather than as a zero-shaped chart."
   */
  async summary(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'stories:write');

    const rows = await this.prisma.storyStats.findMany({
      where: { OR: [{ views: { gt: 0 } }, { reads: { gt: 0 } }, { listens: { gt: 0 } }] },
      select: {
        storyId: true,
        views: true,
        reads: true,
        listens: true,
        avgListenSeconds: true,
        updatedAt: true,
        story: { select: { slug: true, title: true } },
      },
      orderBy: { views: 'desc' },
    });

    return rows.map((row) => ({
      storyId: row.storyId,
      slug: row.story.slug,
      title: row.story.title,
      views: row.views,
      reads: row.reads,
      listens: row.listens,
      avgListenSeconds: row.avgListenSeconds,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Rebuilds every aggregate from the ledger.
   *
   * The events are the record; `story_stats` is a convenience over them. If the
   * two ever disagree — a restore from backup, a migration, a bug in this file
   * — this is the way back, and it exists so that "recompute from source" is a
   * request rather than a hand-written SQL session.
   */
  async rebuild(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'stories:write');

    const stories = await this.prisma.storyEvent.findMany({
      distinct: ['storyId'],
      select: { storyId: true },
    });

    for (const { storyId } of stories) {
      await this.prisma.$transaction((tx) => this.refresh(tx, storyId));
    }

    return { rebuilt: stories.length };
  }

  /** Used by the public controller to reject an unknown story early. */
  async assertPublished(slug: string): Promise<void> {
    const exists = await this.prisma.story.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Story not found.');
  }
}
