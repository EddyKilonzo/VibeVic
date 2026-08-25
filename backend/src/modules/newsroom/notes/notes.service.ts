import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { assertAllExist } from '../../../common/relations/link-set';
import type { CreateNoteDto, UpdateNoteDto } from './note.dto';

const NOT_FOUND = 'Note not found.';

/**
 * Working notes.
 *
 * Tiered, and otherwise the simplest service in the newsroom: a scalar
 * `storyId` rather than a join, because a note belongs to at most one story.
 * The moment that stops being true it becomes a join table like the others, but
 * modelling it as one today would add a query per read to represent a
 * relationship the writing process does not actually have.
 */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.note.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const note = await this.prisma.note.findUnique({ where: { id } });
    this.policy.assertCanRead(principal, note, NOT_FOUND);
    if (!note) throw new NotFoundException(NOT_FOUND);
    return note;
  }

  async create(principal: Principal | undefined, dto: CreateNoteDto) {
    const visibility = dto.visibility ?? Visibility.PRIVATE;
    this.policy.assertCanCreate(principal, visibility);
    if (dto.storyId) await this.assertStoryExists(dto.storyId);

    return this.prisma.note.create({
      data: {
        title: dto.title,
        body: dto.body ?? '',
        storyId: dto.storyId ?? null,
        visibility,
      },
    });
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateNoteDto) {
    const existing = await this.prisma.note.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);

    const { expectedUpdatedAt, storyId, ...rest } = dto;
    const data: Prisma.NoteUncheckedUpdateManyInput = { ...rest };
    if (storyId !== undefined) {
      if (storyId !== null) await this.assertStoryExists(storyId);
      data.storyId = storyId;
    }

    return updateWithOptimisticLock(this.prisma.note, id, expectedUpdatedAt, data, NOT_FOUND);
  }

  async remove(principal: Principal | undefined, id: string) {
    const existing = await this.prisma.note.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, undefined, NOT_FOUND);
    await this.prisma.note.delete({ where: { id } });
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
