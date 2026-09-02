import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { ids, linkDiffPreservingHidden } from '../../../common/relations/link-set';
import type { CreatePitchDto, UpdatePitchDto } from './pitch.dto';

const NOT_FOUND = 'Pitch not found.';

/** A pitch row plus the source links, as the join comes back from Prisma. */
type PitchWithSources = Prisma.PitchGetPayload<{
  include: { sources: { select: { sourceId: true } } };
}>;

/**
 * Pitches.
 *
 * Like ideas, the table carries no `visibility` — the collection is private in
 * whole. Unlike ideas, it points at a table that *is* tiered, and that is the
 * interesting problem in this file.
 *
 * ── Why the source links are filtered ────────────────────────────────────
 * A confidential source is one whose existence must not leak. If a pitch
 * returned its raw `sourceIds`, a principal without `newsroom:confidential`
 * would receive the id of a record the sources API refuses to admit exists —
 * and an id is enough. "This pitch talks to four people and I can only see
 * three" is the disclosure the whole tier is built to prevent.
 *
 * So every read resolves the linked ids against the same `visibilityFilter`
 * the sources service uses, and every write is checked against the same set.
 * The two surfaces cannot disagree, because they are asking the one policy
 * object the same question.
 */
@Injectable()
export class PitchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  private static readonly WITH_SOURCES = {
    sources: { select: { sourceId: true } },
  } satisfies Prisma.PitchInclude;

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.pitch.findMany({
      include: PitchesService.WITH_SOURCES,
      orderBy: { updatedAt: 'desc' },
    });

    // One query for the whole page rather than one per pitch: the visible set
    // is the same for every row, because it is a property of the caller.
    const visible = await this.visibleSourceIds(
      principal,
      rows.flatMap((row) => ids(row.sources, 'sourceId')),
    );
    return rows.map((row) => this.shape(row, visible));
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:read');
    const pitch = await this.prisma.pitch.findUnique({
      where: { id },
      include: PitchesService.WITH_SOURCES,
    });
    if (!pitch) throw new NotFoundException(NOT_FOUND);

    const visible = await this.visibleSourceIds(principal, ids(pitch.sources, 'sourceId'));
    return this.shape(pitch, visible);
  }

  async create(principal: Principal | undefined, dto: CreatePitchDto) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:write');
    const sourceIds = await this.assertSourcesAreLinkable(principal, dto.sourceIds ?? []);

    const created = await this.prisma.pitch.create({
      data: {
        ideaId: dto.ideaId ?? null,
        title: dto.title,
        angle: dto.angle,
        whyItMatters: dto.whyItMatters ?? '',
        whatIsKnown: dto.whatIsKnown ?? '',
        whatIsUnknown: dto.whatIsUnknown ?? '',
        targetPublication: dto.targetPublication ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        storyId: dto.storyId ?? null,
        sources: { create: sourceIds.map((sourceId) => ({ sourceId })) },
      },
      include: PitchesService.WITH_SOURCES,
    });

    return this.shape(created, new Set(sourceIds));
  }

  async update(principal: Principal | undefined, id: string, dto: UpdatePitchDto) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:write');

    const existing = await this.prisma.pitch.findUnique({
      where: { id },
      include: PitchesService.WITH_SOURCES,
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    const { expectedUpdatedAt, sourceIds, deadline, ...rest } = dto;
    const data: Prisma.PitchUncheckedUpdateManyInput = { ...rest };
    if (deadline !== undefined) data.deadline = deadline === null ? null : new Date(deadline);

    // The row is versioned and the links are not, so the CAS runs first: if it
    // rejects, nothing has been written and the links are still the ones the
    // stale copy described.
    const updated = await updateWithOptimisticLock(
      this.prisma.pitch,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    if (sourceIds !== undefined) {
      await this.reconcileSources(principal, id, ids(existing.sources, 'sourceId'), sourceIds);
    }

    return this.get(principal, updated.id);
  }

  async remove(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:write');
    const existing = await this.prisma.pitch.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    // pitch_sources cascades from the pitch side, so the links go with it. The
    // sources themselves are untouched — deleting a pitch must never delete the
    // people it was going to talk to.
    await this.prisma.pitch.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* ── Source links ──────────────────────────────────────────── */

  /**
   * Of the ids given, the ones this principal is allowed to know exist.
   *
   * Empty input short-circuits: `findMany` with an empty `in` is a round trip
   * to be told nothing, and pitches with no sources are the common case early
   * in the life of a story.
   */
  private async visibleSourceIds(
    principal: Principal | undefined,
    candidates: readonly string[],
  ): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();

    const rows = await this.prisma.source.findMany({
      where: {
        id: { in: [...new Set(candidates)] },
        visibility: { in: this.policy.visibilityFilter(principal) },
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  /**
   * Checks a requested set before it is written, and refuses the whole write if
   * any id is not linkable.
   *
   * "Not linkable" covers two cases that are deliberately answered the same
   * way: the source does not exist, and the source is confidential and this
   * caller may not know it does. Telling those apart in the error would hand
   * back exactly the fact the confidential tier protects, so both get the same
   * 404 and the same sentence.
   */
  private async assertSourcesAreLinkable(
    principal: Principal | undefined,
    requested: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(requested)];
    if (unique.length === 0) return [];

    const visible = await this.visibleSourceIds(principal, unique);
    const unknown = unique.filter((id) => !visible.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(
        `No source found for: ${unknown.join(', ')}. Check the ids, or link them from an account that can see confidential sources.`,
      );
    }
    return unique;
  }

  /**
   * Applies a requested set without disturbing links the caller cannot see.
   * The rule, and why it has to work this way, is in `linkDiffPreservingHidden`.
   */
  private async reconcileSources(
    principal: Principal | undefined,
    pitchId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertSourcesAreLinkable(principal, requested);
    const visibleStored = await this.visibleSourceIds(principal, stored);
    const { add, remove } = linkDiffPreservingHidden(stored, linkable, visibleStored);

    if (remove.length > 0) {
      await this.prisma.pitchSource.deleteMany({
        where: { pitchId, sourceId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.pitchSource.createMany({
        data: add.map((sourceId) => ({ pitchId, sourceId })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * Row to wire shape: the join rows become a flat `sourceIds`, filtered.
   *
   * Built by naming fields rather than spreading the row. Same argument the
   * public views make and it holds inside the newsroom too — a column added to
   * `Pitch` next month should reach a client because someone decided it should,
   * not because a spread carried it.
   */
  private shape(pitch: PitchWithSources, visible: ReadonlySet<string>) {
    return {
      id: pitch.id,
      ideaId: pitch.ideaId,
      title: pitch.title,
      angle: pitch.angle,
      whyItMatters: pitch.whyItMatters,
      whatIsKnown: pitch.whatIsKnown,
      whatIsUnknown: pitch.whatIsUnknown,
      targetPublication: pitch.targetPublication,
      deadline: pitch.deadline,
      storyId: pitch.storyId,
      sourceIds: ids(pitch.sources, 'sourceId').filter((id) => visible.has(id)),
      createdAt: pitch.createdAt,
      updatedAt: pitch.updatedAt,
    };
  }
}
