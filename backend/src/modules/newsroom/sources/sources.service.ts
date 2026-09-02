import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { assertAllExist, ids, linkDiff } from '../../../common/relations/link-set';
import type { CreateSourceDto, UpdateSourceDto } from './source.dto';

const NOT_FOUND = 'Source not found.';

/**
 * Sources — the most sensitive table in the system, and the pattern the other
 * newsroom services follow.
 *
 * Two rules that are specific to this table:
 *
 *  1. `protectedIdentity` is never in a default read. Every query here uses an
 *     explicit `select` that omits it, so no route, log line or accidental
 *     `JSON.stringify` of a result can carry it. Getting at it requires calling
 *     `revealProtectedIdentity`, which is one obvious line to find in an audit.
 *  2. Confidential rows are excluded in the `where` clause, not filtered after
 *     loading. A principal without the scope gets a list that does not know
 *     they exist and a 404 on their ids — the existence itself is the secret.
 */
@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Every column except protectedIdentity, plus the story links.
   *
   * Written out, never `omit`-ed — the whole protection is that adding a
   * column to the table does not add it to a response until somebody types it
   * here. The join comes through the same `select` rather than an `include`
   * for exactly that reason: `include` on top of `select` is not how Prisma
   * composes, and reaching for it would have meant abandoning the projection.
   */
  private static readonly SAFE_SELECT = {
    id: true,
    name: true,
    role: true,
    organisation: true,
    url: true,
    accessedAt: true,
    notes: true,
    status: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
    stories: { select: { storyId: true } },
  } satisfies Prisma.SourceSelect;

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.source.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      select: SourcesService.SAFE_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(shape);
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const source = await this.prisma.source.findUnique({
      where: { id },
      select: SourcesService.SAFE_SELECT,
    });
    // Throws 404 for both "missing" and "confidential, and you may not know".
    this.policy.assertCanRead(principal, source, NOT_FOUND);
    if (!source) throw new NotFoundException(NOT_FOUND);
    return shape(source);
  }

  async create(principal: Principal | undefined, dto: CreateSourceDto) {
    const visibility = dto.visibility ?? Visibility.CONFIDENTIAL;
    this.policy.assertCanCreate(principal, visibility);
    if (dto.protectedIdentity !== undefined) {
      this.policy.assertCanReadProtectedIdentity(principal);
    }

    const storyIds = await this.assertStoriesExist(dto.storyIds ?? []);

    const created = await this.prisma.source.create({
      data: {
        name: dto.name,
        role: dto.role ?? null,
        organisation: dto.organisation ?? null,
        url: dto.url ?? null,
        accessedAt: dto.accessedAt ? new Date(dto.accessedAt) : null,
        notes: dto.notes ?? '',
        status: dto.status,
        visibility,
        protectedIdentity: dto.protectedIdentity ?? null,
        stories: { create: storyIds.map((storyId) => ({ storyId })) },
      },
      select: SourcesService.SAFE_SELECT,
    });
    return shape(created);
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateSourceDto) {
    // Authorisation before concurrency, deliberately. A caller who may not
    // touch this record should not learn from a 409 that it exists and was
    // recently edited.
    const existing = await this.prisma.source.findUnique({
      where: { id },
      select: { id: true, visibility: true, stories: { select: { storyId: true } } },
    });
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);
    if (dto.protectedIdentity !== undefined) {
      this.policy.assertCanReadProtectedIdentity(principal);
    }

    const { expectedUpdatedAt, accessedAt, storyIds, ...rest } = dto;
    const data: Prisma.SourceUncheckedUpdateManyInput = { ...rest };
    if (accessedAt !== undefined) data.accessedAt = new Date(accessedAt);

    const updated = await updateWithOptimisticLock(
      this.prisma.source,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    // After the lock, matching every other service that owns a join: the CAS
    // is what decides whether this edit happened at all, and reconciling links
    // for a write that turned out to be stale would apply half of a refused
    // change.
    if (storyIds !== undefined && existing) {
      await this.reconcileStories(id, ids(existing.stories, 'storyId'), storyIds);
    }

    // Re-read through the safe projection: the CAS helper returns the whole
    // row, and the whole row includes the protected identity.
    return this.get(principal, updated.id);
  }

  async remove(principal: Principal | undefined, id: string) {
    const existing = await this.prisma.source.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, undefined, NOT_FOUND);
    await this.prisma.source.delete({ where: { id } });
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

  /**
   * Story links, added and removed to match what was sent.
   *
   * `linkDiff` rather than `linkDiffPreservingHidden`, because stories are not
   * a tiered table — there is no such thing as a story this principal can hold
   * a source against but may not see. The three joins that need the preserving
   * variant all point at `entities` or `sources`, which are.
   */
  private async reconcileStories(
    sourceId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertStoriesExist(requested);
    const { add, remove } = linkDiff(stored, linkable);

    if (remove.length > 0) {
      await this.prisma.storySource.deleteMany({
        where: { sourceId, storyId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.storySource.createMany({
        data: add.map((storyId) => ({ sourceId, storyId })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * The one way to read the identity behind a pseudonym.
   *
   * Separate method, separate route, separate scope — so "who is this source
   * really" is a request that can be logged, rate-limited and reviewed on its
   * own rather than a field that rides along with every list call.
   *
   * The access log this deserves is not written yet; see the README.
   */
  async revealProtectedIdentity(principal: Principal | undefined, id: string) {
    this.policy.assertCanReadProtectedIdentity(principal);
    const source = await this.prisma.source.findUnique({
      where: { id },
      select: { id: true, visibility: true, protectedIdentity: true },
    });
    if (!source) throw new NotFoundException(NOT_FOUND);
    return { id: source.id, protectedIdentity: source.protectedIdentity };
  }
}

/**
 * The join rows folded into the flat `storyIds` the client model declares.
 *
 * A free function rather than a method, so it can be applied to a list without
 * binding `this` and so nothing about it can reach the protected identity: it
 * only ever sees a row that came through `SAFE_SELECT`.
 */
function shape<T extends { stories: { storyId: string }[] }>(row: T) {
  const { stories, ...rest } = row;
  return { ...rest, storyIds: ids(stories, 'storyId') };
}
