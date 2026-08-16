import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { parseBlocks } from '../../common/content/story-block';
import { updateWithOptimisticLock } from '../../common/concurrency/optimistic-concurrency';
import type { StoryWithStats } from '../../common/serialization/views';
import type { CreateStoryDto, UpdateStoryDto } from './dto/story.dto';

/**
 * Published articles and the admin surface behind them.
 *
 * Every public read goes through `publishedWhere`. It is a single exported
 * clause rather than a filter copied into five queries, because the copy that
 * gets forgotten is how a draft ends up in a search result. The public view
 * refuses unpublished stories as well — this is the first of the two checks,
 * not the only one.
 */
@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  /** Scheduled pieces are not public until their moment arrives. */
  private publishedWhere(): Prisma.StoryWhereInput {
    return {
      status: StoryStatus.PUBLISHED,
      publishedAt: { not: null, lte: new Date() },
    };
  }

  listPublished(): Promise<StoryWithStats[]> {
    return this.prisma.story.findMany({
      where: this.publishedWhere(),
      include: { stats: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async bySlug(slug: string): Promise<StoryWithStats> {
    const story = await this.prisma.story.findFirst({
      where: { slug, ...this.publishedWhere() },
      include: { stats: true },
    });
    // 404 for a draft as well as for a missing slug. A distinguishable response
    // would let anyone enumerate which pieces are being worked on.
    if (!story) throw new NotFoundException('Story not found.');
    return story;
  }

  byGenre(genreSlug: string): Promise<StoryWithStats[]> {
    return this.prisma.story.findMany({
      where: { genreSlug, ...this.publishedWhere() },
      include: { stats: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Substring match over title, dek and tags. Honest about what it is: no
   * ranking, no stemming, no body search. Proper search wants a tsvector column
   * and a migration, and pretending otherwise would leave a "search" that
   * quietly misses the article everyone is looking for.
   */
  search(query: string): Promise<StoryWithStats[]> {
    return this.prisma.story.findMany({
      where: {
        ...this.publishedWhere(),
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { dek: { contains: query, mode: 'insensitive' } },
          { tags: { has: query.toLowerCase() } },
        ],
      },
      include: { stats: true },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }

  genres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  publications() {
    return this.prisma.publication.findMany({ orderBy: { period: 'desc' } });
  }

  awards() {
    return this.prisma.award.findMany({ orderBy: { year: 'desc' } });
  }

  /* ── Admin ───────────────────────────────────────────────────────────── */

  /**
   * Drafts and scheduled pieces included — so the scope check happens here as
   * well as in the guard. The guard protects the route; this protects the
   * method, which is what a future internal caller will reach for.
   */
  listAll(principal: Principal | undefined): Promise<StoryWithStats[]> {
    this.policy.requireScope(principal, 'stories:write');
    return this.prisma.story.findMany({
      include: { stats: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(principal: Principal | undefined, dto: CreateStoryDto) {
    this.policy.requireScope(principal, 'stories:write');
    const body = dto.body ? parseBlocks(dto.body) : [];

    return this.prisma.story.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        dek: dto.dek,
        genreSlug: dto.genreSlug,
        tags: dto.tags ?? [],
        status: dto.status ?? StoryStatus.DRAFT,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        readingMinutes: dto.readingMinutes ?? 0,
        featured: dto.featured ?? false,
        placeholder: dto.placeholder ?? false,
        publication: dto.publication ?? null,
        body: body as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update behind the concurrency check. `expectedUpdatedAt` is required by the
   * DTO and enforced in the database, so two admin tabs cannot silently
   * overwrite each other's copy — the second one gets a 409 and its author
   * finds out before the words are gone.
   */
  async update(principal: Principal | undefined, id: string, dto: UpdateStoryDto) {
    this.policy.requireScope(principal, 'stories:write');

    const { expectedUpdatedAt, body, publishedAt, ...rest } = dto;
    const data: Prisma.StoryUncheckedUpdateManyInput = { ...rest };
    if (body !== undefined) {
      data.body = parseBlocks(body) as unknown as Prisma.InputJsonValue;
    }
    if (publishedAt !== undefined) data.publishedAt = new Date(publishedAt);

    return updateWithOptimisticLock(
      this.prisma.story,
      id,
      expectedUpdatedAt,
      data,
      'Story not found.',
    );
  }

  /**
   * Not implemented. Publishing is not a status column write: it needs the
   * scheduled-transition job, a canonical URL check, and a decision about what
   * happens to a story that was public and is being pulled. Writing the easy
   * third of that would make the other two look done.
   */
  publish(_principal: Principal | undefined, _id: string): Promise<never> {
    throw new NotImplementedException(
      'Publishing transitions are not implemented. See README, "Stubbed".',
    );
  }

  /**
   * Not implemented. Counters need de-duplication, bot filtering and a write
   * path that does not lock the article row on every page view; an increment
   * here would produce numbers nobody should quote.
   */
  recordView(_slug: string): Promise<never> {
    throw new NotImplementedException('Analytics collection is not implemented.');
  }
}
