import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { parseExpectedUpdatedAt } from '../../common/concurrency/optimistic-concurrency';
import type { CreateGenreDto, UpdateGenreDto } from './catalog.dto';

const NOT_FOUND = 'Beat not found.';

/**
 * Beats, written from the workspace.
 *
 * ── What was here before ─────────────────────────────────────────────────
 * `lib/beats.ts` kept custom beats in `localStorage` and was honest about the
 * ceiling: "A beat that exists only in this browser still cannot have a public
 * page — it has no row." It could give a draft somewhere to be filed and
 * nothing more. This is the row.
 *
 * ── Why the deletions are so fussy ───────────────────────────────────────
 * `genreSlug` is a foreign key on every story and `parentSlug` is one on every
 * child beat. Removing a beat with either attached is not a tidy-up, it is
 * either an orphaned archive or a cascade that silently deletes published work.
 * The schema already sets `onDelete: Restrict` on the parent relation so the
 * database would refuse the second; this refuses both, in a sentence that says
 * what is in the way and how many.
 */
@Injectable()
export class GenresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'stories:write');
    return this.prisma.genre.findMany({ orderBy: [{ name: 'asc' }] });
  }

  async get(principal: Principal | undefined, slug: string) {
    this.policy.requireScope(principal, 'stories:write');
    const genre = await this.prisma.genre.findUnique({ where: { slug } });
    if (!genre) throw new NotFoundException(NOT_FOUND);
    return genre;
  }

  /**
   * One level of nesting, checked here because the database cannot.
   *
   * The foreign key guarantees a parent exists; it does not stop that parent
   * having a parent of its own. `data/types` is explicit that the taxonomy is
   * two deep — "only one level of nesting exists and nothing here should add a
   * second" — and every helper that walks the tree (`inGenre`,
   * `storiesByGenre`, the beat pages) assumes it. A third level would not
   * error; it would quietly stop appearing under its grandparent.
   */
  private async assertParentIsTopLevel(parentSlug: string): Promise<void> {
    const parent = await this.prisma.genre.findUnique({
      where: { slug: parentSlug },
      select: { slug: true, parentSlug: true },
    });
    if (!parent) {
      throw new BadRequestException(`No beat with the slug "${parentSlug}" exists.`);
    }
    if (parent.parentSlug) {
      throw new BadRequestException(
        `"${parentSlug}" is already filed under "${parent.parentSlug}". Beats are two levels deep, so it cannot also be a parent.`,
      );
    }
  }

  async create(principal: Principal | undefined, dto: CreateGenreDto) {
    this.policy.requireScope(principal, 'stories:write');

    const taken = await this.prisma.genre.findUnique({
      where: { slug: dto.slug },
      select: { slug: true },
    });
    if (taken) {
      // Named rather than left to the unique-constraint handler, because the
      // collision is the whole risk here: two beats sharing a slug would make
      // every story filed under it ambiguous, including published ones.
      throw new ConflictException(`A beat with the slug "${dto.slug}" already exists.`);
    }

    if (dto.parentSlug) await this.assertParentIsTopLevel(dto.parentSlug);

    return this.prisma.genre.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        parentSlug: dto.parentSlug ?? null,
      },
    });
  }

  /**
   * Update, with the same concurrency check as everything else.
   *
   * Written out rather than reusing `updateWithOptimisticLock`, which is keyed
   * on `id`. A beat has no id — its slug is the primary key — so the helper's
   * `where` clause does not fit. The mechanism is identical: a conditional
   * update on the timestamp the caller last saw, and a 409 when it has moved.
   */
  async update(principal: Principal | undefined, slug: string, dto: UpdateGenreDto) {
    this.policy.requireScope(principal, 'stories:write');
    const { expectedUpdatedAt, parentSlug, ...rest } = dto;

    if (parentSlug) {
      if (parentSlug === slug) {
        throw new BadRequestException('A beat cannot be filed under itself.');
      }
      await this.assertParentIsTopLevel(parentSlug);

      // Promoting a beat that already has children under it would create the
      // third level the check above exists to prevent.
      const children = await this.prisma.genre.count({ where: { parentSlug: slug } });
      if (children > 0) {
        throw new BadRequestException(
          `"${slug}" has ${children} subject${children === 1 ? '' : 's'} under it, so it cannot itself be filed under another beat.`,
        );
      }
    }

    const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
    const { count } = await this.prisma.genre.updateMany({
      where: { slug, updatedAt: expected },
      data: {
        ...rest,
        ...(parentSlug === undefined ? {} : { parentSlug }),
        updatedAt: new Date(),
      },
    });

    if (count === 0) {
      const exists = await this.prisma.genre.findUnique({
        where: { slug },
        select: { slug: true },
      });
      if (!exists) throw new NotFoundException(NOT_FOUND);
      throw new ConflictException(
        'This beat changed after you loaded it. Your write was not applied. Reload and reapply your edit.',
      );
    }

    return this.get(principal, slug);
  }

  async remove(principal: Principal | undefined, slug: string) {
    this.policy.requireScope(principal, 'stories:write');

    const existing = await this.prisma.genre.findUnique({
      where: { slug },
      select: { slug: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    const [stories, children] = await Promise.all([
      this.prisma.story.count({ where: { genreSlug: slug } }),
      this.prisma.genre.count({ where: { parentSlug: slug } }),
    ]);

    if (stories > 0 || children > 0) {
      // One sentence naming both counts, because a journalist told only about
      // the first will move the stories and hit the second immediately.
      const blockers = [
        stories > 0 && `${stories} stor${stories === 1 ? 'y is' : 'ies are'} filed under it`,
        children > 0 && `${children} subject${children === 1 ? ' sits' : 's sit'} beneath it`,
      ].filter(Boolean);

      throw new ConflictException(
        `That beat cannot be deleted while ${blockers.join(' and ')}. Move them to another beat first.`,
      );
    }

    await this.prisma.genre.delete({ where: { slug } });
    return { slug, deleted: true };
  }
}
