import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import type { CreateTimelineEventDto, UpdateTimelineEventDto } from './timeline.dto';

const NOT_FOUND = 'Timeline event not found.';

type TimelineRow = Prisma.TimelineEventGetPayload<{
  include: {
    entities: { select: { entityId: true } };
    evidence: { select: { evidenceId: true } };
    stories: { select: { storyId: true } };
  };
}>;

/**
 * The timeline.
 *
 * A row with no visibility column that nonetheless needs most of the filtering
 * the tiered tables need, which is the case worth understanding before adding
 * another table like it.
 *
 * "This happened on 4 March" is not itself a secret. Who it happened to, and
 * which document proves it, can be. So the event is readable by anyone in the
 * newsroom and its *links* are filtered: a reader without the confidential
 * scope gets the event with a shorter list of entities attached, and no way to
 * tell that the list was shortened. That is the intended reading — a timeline
 * that hid whole events would leave visible gaps in the sequence, which is its
 * own kind of disclosure.
 *
 * Ordered by `occurredAt` ascending, not by `updatedAt` like every other
 * service here. A timeline out of chronological order is not a timeline.
 */
@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  private static readonly INCLUDE = {
    entities: { select: { entityId: true } },
    evidence: { select: { evidenceId: true } },
    stories: { select: { storyId: true } },
  } satisfies Prisma.TimelineEventInclude;

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.timelineEvent.findMany({
      include: TimelineService.INCLUDE,
      orderBy: { occurredAt: 'asc' },
    });

    const [entities, evidence] = await Promise.all([
      this.visibleEntityIds(principal, rows.flatMap((row) => ids(row.entities, 'entityId'))),
      this.visibleEvidenceIds(principal, rows.flatMap((row) => ids(row.evidence, 'evidenceId'))),
    ]);
    return rows.map((row) => this.shape(row, entities, evidence));
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const event = await this.prisma.timelineEvent.findUnique({
      where: { id },
      include: TimelineService.INCLUDE,
    });
    if (!event) throw new NotFoundException(NOT_FOUND);

    const [entities, evidence] = await Promise.all([
      this.visibleEntityIds(principal, ids(event.entities, 'entityId')),
      this.visibleEvidenceIds(principal, ids(event.evidence, 'evidenceId')),
    ]);
    return this.shape(event, entities, evidence);
  }

  async create(principal: Principal | undefined, dto: CreateTimelineEventDto) {
    this.policy.requireScope(principal, 'newsroom:write');

    const [entityIds, evidenceIds, storyIds] = await Promise.all([
      this.assertEntitiesAreLinkable(principal, dto.entityIds ?? []),
      this.assertEvidenceIsLinkable(principal, dto.evidenceIds ?? []),
      this.assertStoriesExist(dto.storyIds ?? []),
    ]);

    const created = await this.prisma.timelineEvent.create({
      data: {
        occurredAt: new Date(dto.occurredAt),
        what: dto.what,
        entities: { create: entityIds.map((entityId) => ({ entityId })) },
        evidence: { create: evidenceIds.map((evidenceId) => ({ evidenceId })) },
        stories: { create: storyIds.map((storyId) => ({ storyId })) },
      },
      select: { id: true },
    });

    return this.get(principal, created.id);
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateTimelineEventDto) {
    this.policy.requireScope(principal, 'newsroom:write');

    const existing = await this.prisma.timelineEvent.findUnique({
      where: { id },
      include: TimelineService.INCLUDE,
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    const { expectedUpdatedAt, entityIds, evidenceIds, storyIds, occurredAt, ...rest } = dto;
    const data: Prisma.TimelineEventUncheckedUpdateManyInput = { ...rest };
    if (occurredAt !== undefined) data.occurredAt = new Date(occurredAt);

    const updated = await updateWithOptimisticLock(
      this.prisma.timelineEvent,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    if (entityIds !== undefined) {
      await this.reconcileEntities(principal, id, ids(existing.entities, 'entityId'), entityIds);
    }
    if (evidenceIds !== undefined) {
      await this.reconcileEvidence(principal, id, ids(existing.evidence, 'evidenceId'), evidenceIds);
    }
    if (storyIds !== undefined) {
      await this.reconcileStories(id, ids(existing.stories, 'storyId'), storyIds);
    }

    return this.get(principal, updated.id);
  }

  async remove(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:write');
    const existing = await this.prisma.timelineEvent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    await this.prisma.timelineEvent.delete({ where: { id } });
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

  private async visibleEvidenceIds(
    principal: Principal | undefined,
    candidates: readonly string[],
  ): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const rows = await this.prisma.evidenceItem.findMany({
      where: {
        id: { in: [...new Set(candidates)] },
        visibility: { in: this.policy.visibilityFilter(principal) },
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

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

  private async assertEvidenceIsLinkable(
    principal: Principal | undefined,
    requested: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(requested)];
    if (unique.length === 0) return [];
    const visible = await this.visibleEvidenceIds(principal, unique);
    const unknown = unique.filter((id) => !visible.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(`No evidence found for: ${unknown.join(', ')}.`);
    }
    return unique;
  }

  private async reconcileEntities(
    principal: Principal | undefined,
    timelineEventId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertEntitiesAreLinkable(principal, requested);
    const visibleStored = await this.visibleEntityIds(principal, stored);
    const { add, remove } = linkDiffPreservingHidden(stored, linkable, visibleStored);

    if (remove.length > 0) {
      await this.prisma.timelineEventEntity.deleteMany({
        where: { timelineEventId, entityId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.timelineEventEntity.createMany({
        data: add.map((entityId) => ({ timelineEventId, entityId })),
        skipDuplicates: true,
      });
    }
  }

  private async reconcileEvidence(
    principal: Principal | undefined,
    timelineEventId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertEvidenceIsLinkable(principal, requested);
    const visibleStored = await this.visibleEvidenceIds(principal, stored);
    const { add, remove } = linkDiffPreservingHidden(stored, linkable, visibleStored);

    if (remove.length > 0) {
      await this.prisma.timelineEventEvidence.deleteMany({
        where: { timelineEventId, evidenceId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.timelineEventEvidence.createMany({
        data: add.map((evidenceId) => ({ timelineEventId, evidenceId })),
        skipDuplicates: true,
      });
    }
  }

  private async reconcileStories(
    timelineEventId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertStoriesExist(requested);
    const { add, remove } = linkDiff(stored, linkable);

    if (remove.length > 0) {
      await this.prisma.storyTimelineEvent.deleteMany({
        where: { timelineEventId, storyId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.storyTimelineEvent.createMany({
        data: add.map((storyId) => ({ timelineEventId, storyId })),
        skipDuplicates: true,
      });
    }
  }

  private shape(
    event: TimelineRow,
    visibleEntities: ReadonlySet<string>,
    visibleEvidence: ReadonlySet<string>,
  ) {
    return {
      id: event.id,
      occurredAt: event.occurredAt,
      what: event.what,
      entityIds: ids(event.entities, 'entityId').filter((id) => visibleEntities.has(id)),
      evidenceIds: ids(event.evidence, 'evidenceId').filter((id) => visibleEvidence.has(id)),
      storyIds: ids(event.stories, 'storyId'),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
