import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import { assertAllExist, ids, linkDiff } from '../../../common/relations/link-set';
import type { CreateQuoteDto, UpdateQuoteDto } from './quote.dto';

const NOT_FOUND = 'Quote not found.';

type QuoteWithStories = Prisma.QuoteGetPayload<{
  include: { stories: { select: { storyId: true } } };
}>;

/**
 * Quotes.
 *
 * Tiered like sources, and linked to them, which is why this file has two
 * filters rather than one. The row is hidden by its own `visibility`; the
 * `sourceId` on a row you *can* see is hidden by the visibility of the source
 * it points at.
 *
 * That second filter is easy to miss and the reason it matters is worth
 * spelling out. A quote can be PRIVATE while its source is CONFIDENTIAL — the
 * words are repeatable, the identity is not. Returning the raw `sourceId` would
 * hand a caller without the confidential scope a working key into the sources
 * table, and although that table would then refuse them, the id alone already
 * confirms that a protected source exists and said this. So the attribution is
 * dropped and the quote is returned without it, which is exactly what "off the
 * record" means on paper.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  private static readonly WITH_STORIES = {
    stories: { select: { storyId: true } },
  } satisfies Prisma.QuoteInclude;

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    const rows = await this.prisma.quote.findMany({
      where: { visibility: { in: this.policy.visibilityFilter(principal) } },
      include: QuotesService.WITH_STORIES,
      orderBy: { updatedAt: 'desc' },
    });

    const visibleSources = await this.visibleSourceIds(principal, rows);
    return rows.map((row) => this.shape(row, visibleSources));
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: QuotesService.WITH_STORIES,
    });
    this.policy.assertCanRead(principal, quote, NOT_FOUND);
    // assertCanRead throws on null; this second check is what tells the
    // compiler so, and costs less than a cast that would also silence a real
    // mistake if the policy ever stopped throwing.
    if (!quote) throw new NotFoundException(NOT_FOUND);

    const visibleSources = await this.visibleSourceIds(principal, [quote]);
    return this.shape(quote, visibleSources);
  }

  async create(principal: Principal | undefined, dto: CreateQuoteDto) {
    const visibility = dto.visibility ?? Visibility.PRIVATE;
    this.policy.assertCanCreate(principal, visibility);

    const storyIds = await this.assertStoriesExist(dto.storyIds ?? []);
    if (dto.sourceId) await this.assertSourceIsLinkable(principal, dto.sourceId);

    const created = await this.prisma.quote.create({
      data: {
        text: dto.text,
        speaker: dto.speaker,
        speakerRole: dto.speakerRole ?? null,
        saidAt: dto.saidAt ? new Date(dto.saidAt) : null,
        sourceId: dto.sourceId ?? null,
        interviewId: dto.interviewId ?? null,
        keyQuote: dto.keyQuote ?? false,
        status: dto.status ?? 'UNVERIFIED',
        visibility,
        stories: { create: storyIds.map((storyId) => ({ storyId })) },
      },
      include: QuotesService.WITH_STORIES,
    });

    return this.get(principal, created.id);
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateQuoteDto) {
    const existing = await this.prisma.quote.findUnique({
      where: { id },
      include: QuotesService.WITH_STORIES,
    });
    // Authorisation before concurrency: a caller who may not touch this record
    // should not learn from a 409 that it exists and was recently edited.
    this.policy.assertCanWrite(principal, existing, dto.visibility, NOT_FOUND);

    const { expectedUpdatedAt, storyIds, saidAt, sourceId, ...rest } = dto;
    const data: Prisma.QuoteUncheckedUpdateManyInput = { ...rest };
    if (saidAt !== undefined) data.saidAt = saidAt === null ? null : new Date(saidAt);
    if (sourceId !== undefined) {
      if (sourceId !== null) await this.assertSourceIsLinkable(principal, sourceId);
      data.sourceId = sourceId;
    }

    const updated = await updateWithOptimisticLock(
      this.prisma.quote,
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
    const existing = await this.prisma.quote.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    this.policy.assertCanWrite(principal, existing, undefined, NOT_FOUND);
    await this.prisma.quote.delete({ where: { id } });
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
   * A quote may only be attributed to a source this principal can see.
   *
   * Same 404 for "no such source" and "confidential, and not yours to know
   * about" — the pitches service takes the same line, for the same reason.
   */
  private async assertSourceIsLinkable(
    principal: Principal | undefined,
    sourceId: string,
  ): Promise<void> {
    const source = await this.prisma.source.findFirst({
      where: {
        id: sourceId,
        visibility: { in: this.policy.visibilityFilter(principal) },
      },
      select: { id: true },
    });
    if (!source) throw new NotFoundException(`No source found for: ${sourceId}.`);
  }

  private async reconcileStories(
    quoteId: string,
    stored: readonly string[],
    requested: readonly string[],
  ): Promise<void> {
    const linkable = await this.assertStoriesExist(requested);
    const { add, remove } = linkDiff(stored, linkable);

    if (remove.length > 0) {
      await this.prisma.storyQuote.deleteMany({
        where: { quoteId, storyId: { in: remove } },
      });
    }
    if (add.length > 0) {
      await this.prisma.storyQuote.createMany({
        data: add.map((storyId) => ({ quoteId, storyId })),
        skipDuplicates: true,
      });
    }
  }

  /** The source ids, among those these quotes reference, this caller may see. */
  private async visibleSourceIds(
    principal: Principal | undefined,
    rows: readonly { sourceId: string | null }[],
  ): Promise<Set<string>> {
    const referenced = rows
      .map((row) => row.sourceId)
      .filter((id): id is string => id !== null);
    if (referenced.length === 0) return new Set();

    const sources = await this.prisma.source.findMany({
      where: {
        id: { in: [...new Set(referenced)] },
        visibility: { in: this.policy.visibilityFilter(principal) },
      },
      select: { id: true },
    });
    return new Set(sources.map((row) => row.id));
  }

  private shape(quote: QuoteWithStories, visibleSources: ReadonlySet<string>) {
    return {
      id: quote.id,
      text: quote.text,
      speaker: quote.speaker,
      speakerRole: quote.speakerRole,
      saidAt: quote.saidAt,
      // Null rather than the real id when the source is confidential and this
      // caller may not know it exists. See the note at the top of the file.
      sourceId:
        quote.sourceId && visibleSources.has(quote.sourceId) ? quote.sourceId : null,
      interviewId: quote.interviewId,
      keyQuote: quote.keyQuote,
      status: quote.status,
      visibility: quote.visibility,
      storyIds: ids(quote.stories, 'storyId'),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }
}
