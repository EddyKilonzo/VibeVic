import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { updateWithOptimisticLock } from '../../common/concurrency/optimistic-concurrency';
import type { CreateAwardDto, UpdateAwardDto } from './catalog.dto';

const NOT_FOUND = 'Award not found.';

/**
 * Awards, written from the workspace.
 *
 * ── What was here before ─────────────────────────────────────────────────
 * A public `GET /awards` reading a table nothing could write to, and a screen
 * in the admin that recorded awards to `localStorage`. Its own comment was
 * clear-eyed about the consequence: "a record here is still only a note the
 * journalist made, not a claim the site is making, until it is written through
 * to the API." This is that write path, so the note and the claim are the same
 * record.
 *
 * ── The rule the screen enforces, restated on the server ─────────────────
 * Nothing here is generated, suggested or defaulted. `AdminAwards` says why:
 * inventing a prize for a real journalist would be a fabricated credential, and
 * a form that offers "Winner" pre-selected will eventually record one that was
 * never won. So `result` has no default and is checked against the four the
 * screen offers, and every other field is required. The API refusing a blank is
 * the second of two gates, not a duplicate of the first: this is the one that
 * still holds when somebody posts directly.
 */
@Injectable()
export class AwardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Newest first.
   *
   * By year descending rather than by creation date: an awards list is read as
   * a career in reverse, which is how the public timeline renders it and how
   * the old local store sorted it. `createdAt` breaks ties so two awards from
   * the same year keep a stable order.
   */
  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'stories:write');
    return this.prisma.award.findMany({
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'stories:write');
    const award = await this.prisma.award.findUnique({ where: { id } });
    if (!award) throw new NotFoundException(NOT_FOUND);
    return award;
  }

  create(principal: Principal | undefined, dto: CreateAwardDto) {
    this.policy.requireScope(principal, 'stories:write');
    return this.prisma.award.create({
      data: {
        year: dto.year,
        title: dto.title,
        body: dto.body,
        description: dto.description,
        result: dto.result,
      },
    });
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateAwardDto) {
    this.policy.requireScope(principal, 'stories:write');
    const { expectedUpdatedAt, ...rest } = dto;
    return updateWithOptimisticLock(this.prisma.award, id, expectedUpdatedAt, rest, NOT_FOUND);
  }

  /**
   * Deleting an award is deleting a claim, and that is the easy case.
   *
   * Nothing references an award — no story carries an award id, no view joins
   * one — so removing the row removes the whole fact and leaves nothing
   * dangling. That is precisely why this is a hard delete where a story is not.
   */
  async remove(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'stories:write');
    const existing = await this.prisma.award.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    await this.prisma.award.delete({ where: { id } });
    return { id, deleted: true };
  }
}
