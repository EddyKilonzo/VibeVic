import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
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

  /** Every column except protectedIdentity. Written out, never `omit`-ed. */
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
  } satisfies Prisma.SourceSelect;

  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.source.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      select: SourcesService.SAFE_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const source = await this.prisma.source.findUnique({
      where: { id },
      select: SourcesService.SAFE_SELECT,
    });
    // Throws 404 for both "missing" and "confidential, and you may not know".
    this.policy.assertCanRead(principal, source, NOT_FOUND);
    return source;
  }

  async create(principal: Principal | undefined, dto: CreateSourceDto) {
    const visibility = dto.visibility ?? Visibility.CONFIDENTIAL;
    this.policy.assertCanCreate(principal, visibility);
    if (dto.protectedIdentity !== undefined) {
      this.policy.assertCanReadProtectedIdentity(principal);
    }

    return this.prisma.source.create({
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
      },
      select: SourcesService.SAFE_SELECT,
    });
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateSourceDto) {
    // Authorisation before concurrency, deliberately. A caller who may not
    // touch this record should not learn from a 409 that it exists and was
    // recently edited.
    const existing = await this.prisma.source.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);
    if (dto.protectedIdentity !== undefined) {
      this.policy.assertCanReadProtectedIdentity(principal);
    }

    const { expectedUpdatedAt, accessedAt, ...rest } = dto;
    const data: Prisma.SourceUncheckedUpdateManyInput = { ...rest };
    if (accessedAt !== undefined) data.accessedAt = new Date(accessedAt);

    const updated = await updateWithOptimisticLock(
      this.prisma.source,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    // Re-read through the safe projection: the CAS helper returns the whole
    // row, and the whole row includes the protected identity.
    return this.prisma.source.findUnique({
      where: { id: updated.id },
      select: SourcesService.SAFE_SELECT,
    });
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
