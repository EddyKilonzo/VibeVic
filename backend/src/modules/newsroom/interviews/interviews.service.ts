import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { assertAllExist, ids, linkDiff } from '../../../common/relations/link-set';
import type { CreateInterviewDto, UpdateInterviewDto } from './interview.dto';

const NOT_FOUND = 'Interview not found.';

type InterviewRow = Prisma.InterviewGetPayload<{
  include: {
    stories: { select: { storyId: true } };
    quotes: { select: { id: true; keyQuote: true; visibility: true } };
  };
}>;

/**
 * Interviews.
 *
 * Confidential by default, and the default is the interesting part. Sources and
 * interviews are the two tables where the *existence* of a row is the sensitive
 * fact — "she gave an interview about this" can be as damaging as anything said
 * in it — so both start at CONFIDENTIAL and both are filtered in the `where`
 * clause rather than after loading.
 *
 * ── keyQuoteIds ──────────────────────────────────────────────────────────
 * Derived, never stored here. The flag lives on `Quote.keyQuote`, so this
 * service reads the interview's quotes and reports which are marked. Modelling
 * it as a second list on the interview would let the two disagree, and the
 * schema note on `Quote.keyQuote` makes the same argument: a key quote is by
 * definition one of that interview's quotes, and a join could claim otherwise.
 *
 * The derived list is filtered by the reader's visibility as well. A
 * CONFIDENTIAL quote inside a PRIVATE interview must not have its id announced
 * by the interview it belongs to.
 */
@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  private static readonly INCLUDE = {
    stories: { select: { storyId: true } },
    quotes: { select: { id: true, keyQuote: true, visibility: true } },
  } satisfies Prisma.InterviewInclude;

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.interview.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      include: InterviewsService.INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.shape(row, principal));
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: InterviewsService.INCLUDE,
    });
    this.policy.assertCanRead(principal, interview, NOT_FOUND);
    if (!interview) throw new NotFoundException(NOT_FOUND);

    return this.shape(interview, principal);
  }

  async create(principal: Principal | undefined, dto: CreateInterviewDto) {
    const visibility = dto.visibility ?? Visibility.CONFIDENTIAL;
    this.policy.assertCanCreate(principal, visibility);
    const storyIds = await this.assertStoriesExist(dto.storyIds ?? []);

    const created = await this.prisma.interview.create({
      data: {
        interviewee: dto.interviewee,
        role: dto.role ?? null,
        purpose: dto.purpose ?? '',
        conductedAt: dto.conductedAt ? new Date(dto.conductedAt) : null,
        notes: dto.notes ?? '',
        followUps: dto.followUps ?? [],
        visibility,
        stories: { create: storyIds.map((storyId) => ({ storyId })) },
      },
      select: { id: true },
    });

    return this.get(principal, created.id);
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateInterviewDto) {
    const existing = await this.prisma.interview.findUnique({
      where: { id },
      include: InterviewsService.INCLUDE,
    });
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);

    const { expectedUpdatedAt, storyIds, conductedAt, ...rest } = dto;
    const data: Prisma.InterviewUncheckedUpdateManyInput = { ...rest };
    if (conductedAt !== undefined) {
      data.conductedAt = conductedAt === null ? null : new Date(conductedAt);
    }

    const updated = await updateWithOptimisticLock(
      this.prisma.interview,
      id,
      expectedUpdatedAt,
      data,
      NOT_FOUND,
    );

    if (storyIds !== undefined && existing) {
      await this.reconcileStories(id, ids(existing.stories, 'storyId'), storyIds);
    }

    return this.get(principal, updated.id);
  }

  async remove(principal: Principal | undefined, id: string) {
    const existing = await this.prisma.interview.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, undefined, NOT_FOUND);

    // Quotes survive. `Quote.interviewId` is SetNull on delete, deliberately:
    // removing the record of a meeting must not delete the testimony taken at
    // it, which may already be quoted in a published piece.
    await this.prisma.interview.delete({ where: { id } });
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

  private async reconcileStories(
    interviewId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertStoriesExist(requested);
    const { add, remove } = linkDiff(stored, linkable);

    if (remove.length > 0) {
      await this.prisma.storyInterview.deleteMany({
        where: { interviewId, storyId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.storyInterview.createMany({
        data: add.map((storyId) => ({ interviewId, storyId })),
        skipDuplicates: true,
      });
    }
  }

  private shape(interview: InterviewRow, principal: Principal | undefined) {
    const readable = new Set(this.policy.visibilityFilter(principal));

    return {
      id: interview.id,
      interviewee: interview.interviewee,
      role: interview.role,
      purpose: interview.purpose,
      conductedAt: interview.conductedAt,
      notes: interview.notes,
      followUps: interview.followUps,
      visibility: interview.visibility,
      keyQuoteIds: interview.quotes
        .filter((quote) => quote.keyQuote && readable.has(quote.visibility))
        .map((quote) => quote.id),
      storyIds: ids(interview.stories, 'storyId'),
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
    };
  }
}
