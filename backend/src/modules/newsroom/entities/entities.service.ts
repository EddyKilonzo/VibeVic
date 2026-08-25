import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import type { CreateEntityDto, UpdateEntityDto } from './entity.dto';

const NOT_FOUND = 'Entity not found.';

/**
 * Entities.
 *
 * The plainest of the tiered tables: a visibility column, no joins owned from
 * this side, and therefore nothing to filter beyond the rows themselves. The
 * joins that exist — evidence and timeline events pointing at entities — are
 * managed from those services, because the record that names a link is the one
 * that should be responsible for it.
 *
 * Ordered by name rather than `updatedAt`, and that is the one deliberate
 * difference from its neighbours. Entities are looked up ("what did we decide
 * to call this company"), not reviewed, and alphabetical is how a person scans
 * a list they are looking something up in.
 */
@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.entity.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      orderBy: { name: 'asc' },
    });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const entity = await this.prisma.entity.findUnique({ where: { id } });
    this.policy.assertCanRead(principal, entity, NOT_FOUND);
    if (!entity) throw new NotFoundException(NOT_FOUND);
    return entity;
  }

  create(principal: Principal | undefined, dto: CreateEntityDto) {
    const visibility = dto.visibility ?? Visibility.PRIVATE;
    this.policy.assertCanCreate(principal, visibility);

    return this.prisma.entity.create({
      data: {
        kind: dto.kind,
        name: dto.name,
        aliases: dto.aliases ?? [],
        note: dto.note ?? '',
        visibility,
      },
    });
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateEntityDto) {
    const existing = await this.prisma.entity.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);

    const { expectedUpdatedAt, ...rest } = dto;
    const data: Prisma.EntityUncheckedUpdateManyInput = { ...rest };

    return updateWithOptimisticLock(this.prisma.entity, id, expectedUpdatedAt, data, NOT_FOUND);
  }

  async remove(principal: Principal | undefined, id: string) {
    const existing = await this.prisma.entity.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, undefined, NOT_FOUND);

    // The join rows cascade; the evidence and timeline events they pointed at
    // do not. Forgetting who an entity was must not delete what was proved.
    await this.prisma.entity.delete({ where: { id } });
    return { id, deleted: true };
  }
}
