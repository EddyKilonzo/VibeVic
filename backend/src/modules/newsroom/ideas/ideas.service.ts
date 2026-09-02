import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import type { CreateIdeaDto, UpdateIdeaDto } from './idea.dto';

const NOT_FOUND = 'Idea not found.';

/**
 * Ideas.
 *
 * The one newsroom table with no `visibility` column, and that is a modelling
 * decision rather than an oversight: the whole collection is private, so there
 * is no per-row judgement to make and no column that could be set to
 * PUBLISHABLE by a mistake nobody reviews. `ideas` is in PRIVATE_COLLECTIONS on
 * the client and in the tripwire's forbidden list on the server, so an idea
 * cannot reach a reader even if a route were marked public by accident.
 *
 * The consequence for this file is that the scope check is the whole check.
 * There is no `visibilityFilter` to apply and no confidential tier to hide, so
 * `list` returns everything the newsroom holds — which is the correct answer
 * when the answer is "your own notebook".
 */
@Injectable()
export class IdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Newest activity first, not newest creation.
   *
   * An idea that was revisited this morning is more use at the top of the list
   * than one typed last week and untouched since, and `updatedAt` is the column
   * that knows the difference.
   */
  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.idea.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:read');
    const idea = await this.prisma.idea.findUnique({ where: { id } });
    if (!idea) throw new NotFoundException(NOT_FOUND);
    return idea;
  }

  create(principal: Principal | undefined, dto: CreateIdeaDto) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:write');

    return this.prisma.idea.create({
      data: {
        title: dto.title,
        note: dto.note ?? '',
        tags: dto.tags ?? [],
        genre: dto.genre,
        // The schema defaults cover these; naming them keeps the row this call
        // produces readable here rather than only in schema.prisma.
        priority: dto.priority ?? 'MEDIUM',
        stage: dto.stage ?? 'SPARK',
        storyId: dto.storyId ?? null,
      },
    });
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateIdeaDto) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:write');

    const { expectedUpdatedAt, ...rest } = dto;
    // `storyId: null` detaches; `storyId` absent leaves the link alone. Spread
    // preserves that distinction — an explicit null survives, a missing key is
    // simply not in the object and Prisma does not touch the column.
    const data: Prisma.IdeaUncheckedUpdateManyInput = { ...rest };

    return updateWithOptimisticLock(this.prisma.idea, id, expectedUpdatedAt, data, NOT_FOUND);
  }

  async remove(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:ideas');
    this.policy.requireScope(principal, 'newsroom:write');

    // Read first so a delete of something already gone is a 404 rather than a
    // Prisma P2025 surfacing as a 500. The Ideas screen offers an undo built
    // from the record it still holds, so it needs the failure to be legible.
    const existing = await this.prisma.idea.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    await this.prisma.idea.delete({ where: { id } });
    return { id, deleted: true };
  }
}
