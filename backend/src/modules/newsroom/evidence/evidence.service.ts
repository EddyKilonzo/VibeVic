import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import {
  assertAllExist,
  ids,
  linkDiff,
  linkDiffPreservingHidden,
} from '../../../common/relations/link-set';
import type { CreateEvidenceDto, UpdateEvidenceDto } from './evidence.dto';

const NOT_FOUND = 'Evidence not found.';

type EvidenceRow = Prisma.EvidenceItemGetPayload<{
  include: {
    entities: { select: { entityId: true } };
    stories: { select: { storyId: true } };
  };
}>;

/**
 * Evidence.
 *
 * The most connected record in the newsroom: it has its own visibility, it
 * points at a source that has one, and it names entities that have one too. All
 * three tiers are applied, and they are applied in different ways for reasons
 * worth keeping straight.
 *
 *   * The row itself is filtered in the `where` clause, so a confidential item
 *     is not counted, paginated or mentioned.
 *   * `sourceId` is masked to null on a row you may read but whose source you
 *     may not know about — the document is real, who supplied it is not yours.
 *   * `entityIds` is filtered on read and preserved on write, so an edit made
 *     without the confidential scope cannot silently unlink what it never saw.
 *
 * Stories are the odd one out and get none of this. `Story` has a publication
 * status, not a visibility, and an unpublished draft is not a secret from the
 * one newsroom that is writing it.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  private static readonly INCLUDE = {
    entities: { select: { entityId: true } },
    stories: { select: { storyId: true } },
  } satisfies Prisma.EvidenceItemInclude;

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.evidenceItem.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      include: EvidenceService.INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    const [visibleEntities, visibleSources] = await Promise.all([
      this.visibleEntityIds(principal, rows.flatMap((row) => ids(row.entities, 'entityId'))),
      this.visibleSourceIds(principal, rows),
    ]);
    return rows.map((row) => this.shape(row, visibleEntities, visibleSources));
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const item = await this.prisma.evidenceItem.findUnique({
      where: { id },
      include: EvidenceService.INCLUDE,
    });
    this.policy.assertCanRead(principal, item, NOT_FOUND);
    if (!item) throw new NotFoundException(NOT_FOUND);

    const [visibleEntities, visibleSources] = await Promise.all([
      this.visibleEntityIds(principal, ids(item.entities, 'entityId')),
      this.visibleSourceIds(principal, [item]),
    ]);
    return this.shape(item, visibleEntities, visibleSources);
  }

  async create(principal: Principal | undefined, dto: CreateEvidenceDto) {
    const visibility = dto.visibility ?? Visibility.PRIVATE;
    this.policy.assertCanCreate(principal, visibility);

    const [entityIds, storyIds] = await Promise.all([
      this.assertEntitiesAreLinkable(principal, dto.entityIds ?? []),
      this.assertStoriesExist(dto.storyIds ?? []),
    ]);
    if (dto.sourceId) await this.assertSourceIsLinkable(principal, dto.sourceId);

    const created = await this.prisma.evidenceItem.create({
      data: {
        title: dto.title,
        supports: dto.supports ?? '',
        sourceId: dto.sourceId ?? null,
        reference: dto.reference ?? null,
        visibility,
        entities: { create: entityIds.map((entityId) => ({ entityId })) },
        stories: { create: storyIds.map((storyId) => ({ storyId })) },
      },
      select: { id: true },
    });

    return this.get(principal, created.id);
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateEvidenceDto) {
    const existing = await this.prisma.evidenceItem.findUnique({
      where: { id },
      include: EvidenceService.INCLUDE,
    });
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);

    const { expectedUpdatedAt, entityIds, storyIds, sourceId, ...rest } = dto;
    const data: Prisma.EvidenceItemUncheckedUpdateManyInput = { ...rest };
    if (sourceId !== undefined) {
      if (sourceId !== null) await this.assertSourceIsLinkable(principal, sourceId);
      data.sourceId = sourceId;
    }

    const updated = await updateWithOptimisticLock(
      this.prisma.evidenceItem,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    if (existing) {
      if (entityIds !== undefined) {
        await this.reconcileEntities(principal, id, ids(existing.entities, 'entityId'), entityIds);
      }
      if (storyIds !== undefined) {
        await this.reconcileStories(id, ids(existing.stories, 'storyId'), storyIds);
      }
    }

    return this.get(principal, updated.id);
  }

  async remove(principal: Principal | undefined, id: string) {
    const existing = await this.prisma.evidenceItem.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, undefined, NOT_FOUND);
    await this.prisma.evidenceItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* ── Links ─────────────────────────────────────────────────── */

  private assertStoriesExist(requested: readonly string[]): Promise<string[]> {
    return assertAllExist(
      this.prisma.story,
      requested,
      (missing) => `No story found for: ${missing.join(', ')}.`,
    );
  }

  private async visibleEntityIds(
    principal: Principal | undefined,
    candidates: readonly string[],
  ): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const rows = await this.prisma.entity.findMany({
      where: {
        id: { in: [...new Set(candidates)] },
        visibility: { in: this.policy.visibilityFilter(principal) },
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  private async visibleSourceIds(
    principal: Principal | undefined,
    rows: readonly { sourceId: string | null }[],
  ): Promise<Set<string>> {
    const referenced = rows
      .map((row) => row.sourceId)
      .filter((value): value is string => value !== null);
    if (referenced.length === 0) return new Set();

    const sources = await this.prisma.source.findMany({
      where: {
        id: { in: [...new Set(referenced)] },
        visibility: { in: this.policy.visibilityFilter(principal) },
      },
      select: { id: true },
    });
    return new Set(sources.map((row) => row.id));
  }

  /** Same 404 for "no such entity" and "confidential, and not yours to know". */
  private async assertEntitiesAreLinkable(
    principal: Principal | undefined,
    requested: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(requested)];
    if (unique.length === 0) return [];

    const visible = await this.visibleEntityIds(principal, unique);
    const unknown = unique.filter((id) => !visible.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(`No entity found for: ${unknown.join(', ')}.`);
    }
    return unique;
  }

  private async assertSourceIsLinkable(
    principal: Principal | undefined,
    sourceId: string,
  ): Promise<void> {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, visibility: { in: this.policy.visibilityFilter(principal) } },
      select: { id: true },
    });
    if (!source) throw new NotFoundException(`No source found for: ${sourceId}.`);
  }

  private async reconcileEntities(
    principal: Principal | undefined,
    evidenceId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertEntitiesAreLinkable(principal, requested);
    const visibleStored = await this.visibleEntityIds(principal, stored);
    const { add, remove } = linkDiffPreservingHidden(stored, linkable, visibleStored);

    if (remove.length > 0) {
      await this.prisma.evidenceEntity.deleteMany({
        where: { evidenceId, entityId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.evidenceEntity.createMany({
        data: add.map((entityId) => ({ evidenceId, entityId })),
        skipDuplicates: true,
      });
    }
  }

  private async reconcileStories(
    evidenceId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertStoriesExist(requested);
    const { add, remove } = linkDiff(stored, linkable);

    if (remove.length > 0) {
      await this.prisma.storyEvidence.deleteMany({
        where: { evidenceId, storyId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.storyEvidence.createMany({
        data: add.map((storyId) => ({ evidenceId, storyId })),
        skipDuplicates: true,
      });
    }
  }

  private shape(
    item: EvidenceRow,
    visibleEntities: ReadonlySet<string>,
    visibleSources: ReadonlySet<string>,
  ) {
    return {
      id: item.id,
      title: item.title,
      supports: item.supports,
      sourceId: item.sourceId && visibleSources.has(item.sourceId) ? item.sourceId : null,
      reference: item.reference,
      visibility: item.visibility,
      entityIds: ids(item.entities, 'entityId').filter((id) => visibleEntities.has(id)),
      storyIds: ids(item.stories, 'storyId'),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
