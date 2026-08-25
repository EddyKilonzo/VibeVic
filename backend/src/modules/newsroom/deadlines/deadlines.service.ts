import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { assertAllExist } from '../../../common/relations/link-set';
import type { CreateDeadlineDto, UpdateDeadlineDto } from './deadline.dto';

const NOT_FOUND = 'Deadline not found.';

/**
 * Deadlines.
 *
 * No visibility column, nothing sensitive in the row, and it is still behind
 * the newsroom door — because "which investigation is due on Thursday" is a
 * schedule of unpublished work, and a list of what a newsroom is about to
 * publish is worth something to the people it is about.
 *
 * Ordered by `dueAt` ascending, including the ones already marked done. Hiding
 * completed deadlines would be a filter, and a filter belongs to the screen
 * asking the question, not to the endpoint answering it — the dashboard wants
 * "what is left", a review of the week wants "what was promised".
 */
@Injectable()
export class DeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.deadline.findMany({ orderBy: { dueAt: 'asc' } });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const deadline = await this.prisma.deadline.findUnique({ where: { id } });
    if (!deadline) throw new NotFoundException(NOT_FOUND);
    return deadline;
  }

  async create(principal: Principal | undefined, dto: CreateDeadlineDto) {
    this.policy.requireScope(principal, 'newsroom:write');
    if (dto.storyId) await this.assertStoryExists(dto.storyId);

    return this.prisma.deadline.create({
      data: {
        storyId: dto.storyId ?? null,
        label: dto.label,
        dueAt: new Date(dto.dueAt),
        done: dto.done ?? false,
      },
    });
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateDeadlineDto) {
    this.policy.requireScope(principal, 'newsroom:write');

    const { expectedUpdatedAt, storyId, dueAt, ...rest } = dto;
    const data: Prisma.DeadlineUncheckedUpdateManyInput = { ...rest };
    if (dueAt !== undefined) data.dueAt = new Date(dueAt);
    if (storyId !== undefined) {
      if (storyId !== null) await this.assertStoryExists(storyId);
      data.storyId = storyId;
    }

    return updateWithOptimisticLock(this.prisma.deadline, id, expectedUpdatedAt, data, NOT_FOUND);
  }

  async remove(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:write');
    const existing = await this.prisma.deadline.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    await this.prisma.deadline.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertStoryExists(storyId: string): Promise<void> {
    await assertAllExist(
      this.prisma.story,
      [storyId],
      (missing) => `No story found for: ${missing.join(', ')}.`,
    );
  }
}
