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

  /**
   * One story by id, drafts included — what the editor opens.
   *
   * By id rather than slug: a draft may not have a settled slug yet, and the
   * workspace URL is the id. The scope check is here as well as on the route
   * for the same reason as `listAll`.
   */
  async byId(principal: Principal | undefined, id: string): Promise<StoryWithStats> {
    this.policy.requireScope(principal, 'stories:write');
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: { stats: true },
    });
    if (!story) throw new NotFoundException('Story not found.');
    return story;
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
        sourceUrl: dto.sourceUrl ?? null,
        cover: dto.cover ?? null,
        // No cast. `StoryBlock[]` is zod-inferred, so it is a type alias rather
        // than an interface and picks up an implicit index signature — which is
        // exactly what Prisma's InputJsonValue asks for. The `as unknown as`
        // that used to sit here was never needed, and it was hiding the fact
        // that the block union really is valid JSON by construction.
        body,
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
      data.body = parseBlocks(body);
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
   * Not implemented, and the one stub left in this service.
   *
   * Publishing is not a status column write: it needs the scheduled-transition
   * job, a canonical URL check, and a decision about what happens to a story
   * that was public and is being pulled. Writing the easy third of that would
   * make the other two look done — which is why `story-records.ts` on the
   * frontend keeps `status` out of every ordinary write and routes the
   * transition here instead.
   *
   * `async`, so the rejection arrives as the `Promise<never>` the signature
   * advertises. Thrown synchronously it was neither: a caller who reached for
   * `.catch()` got an exception through the call itself.
   */
  async publish(_principal: Principal | undefined, _id: string): Promise<never> {
    // Names the three missing pieces rather than citing a README section. The
    // message used to say `See README, "Stubbed"`; there is no README in this
    // package and no such heading anywhere in the repository, so the one
    // sentence a writer saw sent them looking for a document that never
    // existed.
    throw new NotImplementedException(
      'Publishing transitions are not implemented: the scheduled-transition job, ' +
        'the canonical URL check and the un-publishing rule all have to land together.',
    );
  }
}
