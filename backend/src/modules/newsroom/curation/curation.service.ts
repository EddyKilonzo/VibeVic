import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PortfolioClass } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { assertAllExist } from '../../../common/relations/link-set';
import type {
  CreateCollectionDto,
  SetStyleGuideDto,
  UpdateCollectionDto,
} from './curation.dto';

const NOT_FOUND = 'Collection not found.';

type CollectionRow = Prisma.CollectionGetPayload<{
  include: { stories: { select: { storyId: true; position: true } } };
}>;

/**
 * Curation — collections, portfolio classes, and the house style guide.
 *
 * None of these are tiered. They describe published work rather than the
 * reporting behind it, and the frontend's `toPublicPayload` names collections
 * and portfolio as the two things a public payload may carry. They are served
 * from the newsroom surface all the same, because nothing reader-facing renders
 * them yet and a public route would need a declared view in `views.ts` to exist
 * at all — the serialiser refuses a public route without one.
 *
 * ── Order is data ────────────────────────────────────────────────────────
 * A collection's running order is the editorial judgement in it. It is stored
 * as an integer position with a unique constraint per collection, so two
 * stories cannot claim the same slot, and it is rewritten as a block whenever
 * the list changes. That last part is the opposite of what the other join
 * tables do, and deliberately: `linkDiff` exists to preserve `createdAt` on
 * links that did not change, but every position after an insertion *has*
 * changed, so there is nothing to preserve and a diff would only be a slower
 * way to reach the same rows.
 */
@Injectable()
export class CurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  private static readonly WITH_STORIES = {
    stories: { select: { storyId: true, position: true } },
  } satisfies Prisma.CollectionInclude;

  /* ── Collections ───────────────────────────────────────────── */

  async listCollections(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.collection.findMany({
      include: CurationService.WITH_STORIES,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.shapeCollection(row));
  }

  async getCollection(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: CurationService.WITH_STORIES,
    });
    if (!collection) throw new NotFoundException(NOT_FOUND);
    return this.shapeCollection(collection);
  }

  async createCollection(principal: Principal | undefined, dto: CreateCollectionDto) {
    this.policy.requireScope(principal, 'newsroom:write');
    const storyIds = await this.assertRunningOrderIsValid(dto.storyIds ?? [], dto.coverStoryId);

    const created = await this.prisma.collection.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        coverStoryId: dto.coverStoryId ?? null,
        stories: {
          create: storyIds.map((storyId, position) => ({ storyId, position })),
        },
      },
      select: { id: true },
    });

    return this.getCollection(principal, created.id);
  }

  async updateCollection(
    principal: Principal | undefined,
    id: string,
    dto: UpdateCollectionDto,
  ) {
    this.policy.requireScope(principal, 'newsroom:write');
    const existing = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    const { expectedUpdatedAt, storyIds, ...rest } = dto;
    const orderedIds =
      storyIds === undefined
        ? undefined
        : await this.assertRunningOrderIsValid(storyIds, dto.coverStoryId ?? undefined);

    const data: Prisma.CollectionUncheckedUpdateManyInput = { ...rest };
    const updated = await updateWithOptimisticLock(
      this.prisma.collection,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    if (orderedIds !== undefined) await this.rewriteRunningOrder(id, orderedIds);

    return this.getCollection(principal, updated.id);
  }

  async removeCollection(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:write');
    const existing = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    await this.prisma.collection.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Every story must exist, none may appear twice, and a named cover must be
   * one of them.
   *
   * The duplicate check is the reason this is not just `assertAllExist`. A
   * repeated id in a set is harmless and gets collapsed; a repeated id in a
   * running order is a contradiction — the story cannot be both third and
   * seventh — and silently dropping one copy would renumber everything after it
   * without saying so.
   */
  private async assertRunningOrderIsValid(
    storyIds: readonly string[],
    coverStoryId?: string,
  ): Promise<string[]> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of storyIds) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    if (duplicates.size > 0) {
      throw new BadRequestException(
        `A collection lists each story once. Repeated: ${[...duplicates].join(', ')}.`,
      );
    }

    await assertAllExist(
      this.prisma.story,
      storyIds,
      (missing) => `No story found for: ${missing.join(', ')}.`,
    );

    if (coverStoryId !== undefined && !storyIds.includes(coverStoryId)) {
      throw new BadRequestException(
        'The cover story must be one of the stories in the collection.',
      );
    }

    return [...storyIds];
  }

  /**
   * Replaces the running order in one transaction.
   *
   * The delete and the insert have to be atomic. `@@unique([collectionId,
   * position])` means a half-applied reorder is not merely wrong but
   * unrepresentable — the insert would collide with rows the delete had not
   * removed yet — so a failure between the two would leave a collection whose
   * order cannot be written at all until someone clears it by hand.
   */
  private async rewriteRunningOrder(
    collectionId: string,
    storyIds: readonly string[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.collectionStory.deleteMany({ where: { collectionId } }),
      this.prisma.collectionStory.createMany({
        data: storyIds.map((storyId, position) => ({ collectionId, storyId, position })),
      }),
    ]);
  }

  private shapeCollection(collection: CollectionRow) {
    return {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      // Sorted here rather than trusted from the include: the position column
      // is the running order, and returning rows in whatever order the join
      // came back in would quietly discard the whole point of storing it.
      storyIds: [...collection.stories]
        .sort((a, b) => a.position - b.position)
        .map((row) => row.storyId),
      coverStoryId: collection.coverStoryId,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  /* ── Portfolio classes ─────────────────────────────────────── */

  /**
   * Returned as a map keyed by story id, matching the frontend's
   * `Newsroom["portfolio"]`. A list of rows would be more RESTful and would
   * make every consumer build this map itself.
   */
  async portfolio(principal: Principal | undefined): Promise<Record<string, PortfolioClass>> {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.portfolioEntry.findMany({
      select: { storyId: true, class: true },
    });

    const map: Record<string, PortfolioClass> = {};
    for (const row of rows) map[row.storyId] = row.class;
    return map;
  }

  /**
   * Upsert rather than create-or-update, because the caller is stating a fact
   * about a story ("this one is the investigation") and should not have to know
   * whether anybody has rated it before.
   *
   * No `expectedUpdatedAt` here, and that is the one deliberate exception to
   * the rule the rest of the API keeps. A portfolio class is a single enum with
   * no partial state to lose: the last writer wins and nothing they overwrite
   * was text somebody typed. Demanding a version token for it would train
   * callers to fetch-then-write for a value that cannot be merged anyway.
   */
  async setPortfolioClass(
    principal: Principal | undefined,
    storyId: string,
    value: PortfolioClass,
  ) {
    this.policy.requireScope(principal, 'newsroom:write');
    await assertAllExist(
      this.prisma.story,
      [storyId],
      (missing) => `No story found for: ${missing.join(', ')}.`,
    );

    const entry = await this.prisma.portfolioEntry.upsert({
      where: { storyId },
      create: { storyId, class: value },
      update: { class: value },
      select: { storyId: true, class: true },
    });
    return entry;
  }

  async clearPortfolioClass(principal: Principal | undefined, storyId: string) {
    this.policy.requireScope(principal, 'newsroom:write');
    const existing = await this.prisma.portfolioEntry.findUnique({
      where: { storyId },
      select: { storyId: true },
    });
    if (!existing) throw new NotFoundException('That story has no portfolio class set.');

    await this.prisma.portfolioEntry.delete({ where: { storyId } });
    return { storyId, deleted: true };
  }

  /* ── Style guide ───────────────────────────────────────────── */

  styleGuide(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.styleGuideEntry.findMany({ orderBy: { preferred: 'asc' } });
  }

  /**
   * Replaces the guide wholesale, in a transaction.
   *
   * See the DTO for why this is not per-entry CRUD. The transaction is what
   * makes "replace" honest: without it a failure partway through would leave
   * the guide as neither the old one nor the new one, which for a document
   * about house style means copy silently checked against half a rulebook.
   */
  async setStyleGuide(principal: Principal | undefined, dto: SetStyleGuideDto) {
    this.policy.requireScope(principal, 'newsroom:write');

    await this.prisma.$transaction([
      this.prisma.styleGuideEntry.deleteMany({}),
      this.prisma.styleGuideEntry.createMany({
        data: dto.entries.map((entry) => ({
          preferred: entry.preferred,
          avoid: entry.avoid ?? [],
          why: entry.why ?? null,
        })),
      }),
    ]);

    return this.prisma.styleGuideEntry.findMany({ orderBy: { preferred: 'asc' } });
  }
}
