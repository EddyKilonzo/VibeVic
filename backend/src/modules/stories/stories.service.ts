import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { parseBlocks } from '../../common/content/story-block';
import { updateWithOptimisticLock } from '../../common/concurrency/optimistic-concurrency';
import type { StoryWithStats } from '../../common/serialization/views';
import type { Env } from '../../config/env';
import type {
  CreateStoryDto,
  PublishStoryDto,
  UpdateStoryDto,
} from './dto/story.dto';

/**
 * At most one revision per story per this long — unless the piece is live, in
 * which case every edit is a correction and gets its own. See `snapshot`.
 */
const REVISION_INTERVAL_MS = 10 * 60 * 1000;

/** How many revisions a story keeps. See `prune` for why it is a count. */
const REVISION_LIMIT = 50;

/**
 * Published articles and the admin surface behind them.
 *
 * Every public read goes through `publishedWhere`. It is a single exported
 * clause rather than a filter copied into five queries, because the copy that
 * gets forgotten is how a draft ends up in a search result. The public view
 * refuses unpublished stories as well — this is the first of the two checks,
 * not the only one.
 */
@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * What "public" means, in one clause — and where the scheduled transition
   * actually happens.
   *
   * Two columns decide it: a date that has arrived, and a status that is not
   * DRAFT. A SCHEDULED row whose `publishedAt` has passed is public *here*,
   * without waiting for anything to flip the column, which is why an embargo
   * is honoured to the second and why no background job can fail and quietly
   * keep a piece off the site. `StoriesService.promoteDueScheduled` tidies the
   * column afterwards for the admin list's benefit; it is not what makes the
   * piece readable. See the long note on `publish`.
   *
   * DRAFT stays out on the status, not on the date, and that is the
   * un-publishing rule seen from the reader's side: a pulled piece keeps the
   * date it originally ran, so it would satisfy a date-only test forever.
   */
  private publishedWhere(): Prisma.StoryWhereInput {
    return {
      status: { in: [StoryStatus.PUBLISHED, StoryStatus.SCHEDULED] },
      publishedAt: { not: null, lte: new Date() },
    };
  }

  listPublished(): Promise<StoryWithStats[]> {
    return this.prisma.story.findMany({
      where: this.publishedWhere(),
      include: { stats: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async bySlug(slug: string): Promise<StoryWithStats> {
    const story = await this.prisma.story.findFirst({
      where: { slug, ...this.publishedWhere() },
      include: { stats: true },
    });
    // 404 for a draft as well as for a missing slug. A distinguishable response
    // would let anyone enumerate which pieces are being worked on.
    if (!story) throw new NotFoundException('Story not found.');
    return story;
  }

  byGenre(genreSlug: string): Promise<StoryWithStats[]> {
    return this.prisma.story.findMany({
      where: { genreSlug, ...this.publishedWhere() },
      include: { stats: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Substring match over title, dek and tags. Honest about what it is: no
   * ranking, no stemming, no body search. Proper search wants a tsvector column
   * and a migration, and pretending otherwise would leave a "search" that
   * quietly misses the article everyone is looking for.
   */
  search(query: string): Promise<StoryWithStats[]> {
    return this.prisma.story.findMany({
      where: {
        ...this.publishedWhere(),
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { dek: { contains: query, mode: 'insensitive' } },
          { tags: { has: query.toLowerCase() } },
        ],
      },
      include: { stats: true },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }

  genres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  publications() {
    return this.prisma.publication.findMany({ orderBy: { period: 'desc' } });
  }

  awards() {
    return this.prisma.award.findMany({ orderBy: { year: 'desc' } });
  }

  /* ── Admin ───────────────────────────────────────────────────────────── */

  /**
   * Drafts and scheduled pieces included — so the scope check happens here as
   * well as in the guard. The guard protects the route; this protects the
   * method, which is what a future internal caller will reach for.
   */
  async listAll(principal: Principal | undefined): Promise<StoryWithStats[]> {
    this.policy.requireScope(principal, 'stories:write');
    // Before the read, so the list never shows "scheduled" against a piece the
    // public can already read. Bookkeeping only — see `promoteDueScheduled`.
    await this.promoteDueScheduled();
    return this.prisma.story.findMany({
      include: { stats: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * One story by id, drafts included — what the editor opens.
   *
   * By id rather than slug: a draft may not have a settled slug yet, and the
   * workspace URL is the id. The scope check is here as well as on the route
   * for the same reason as `listAll`.
   */
  async byId(principal: Principal | undefined, id: string): Promise<StoryWithStats> {
    this.policy.requireScope(principal, 'stories:write');
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: { stats: true },
    });
    if (!story) throw new NotFoundException('Story not found.');
    return story;
  }

  async create(principal: Principal | undefined, dto: CreateStoryDto) {
    this.policy.requireScope(principal, 'stories:write');
    const body = dto.body ? parseBlocks(dto.body) : [];

    return this.prisma.story.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        dek: dto.dek,
        genreSlug: dto.genreSlug,
        tags: dto.tags ?? [],
        status: dto.status ?? StoryStatus.DRAFT,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        readingMinutes: dto.readingMinutes ?? 0,
        featured: dto.featured ?? false,
        placeholder: dto.placeholder ?? false,
        publication: dto.publication ?? null,
        sourceUrl: dto.sourceUrl ?? null,
        cover: dto.cover ?? null,
        // No cast. `StoryBlock[]` is zod-inferred, so it is a type alias rather
        // than an interface and picks up an implicit index signature — which is
        // exactly what Prisma's InputJsonValue asks for. The `as unknown as`
        // that used to sit here was never needed, and it was hiding the fact
        // that the block union really is valid JSON by construction.
        body,
      },
    });
  }

  /**
   * Update behind the concurrency check. `expectedUpdatedAt` is required by the
   * DTO and enforced in the database, so two admin tabs cannot silently
   * overwrite each other's copy — the second one gets a 409 and its author
   * finds out before the words are gone.
   */
  async update(principal: Principal | undefined, id: string, dto: UpdateStoryDto) {
    this.policy.requireScope(principal, 'stories:write');

    const { expectedUpdatedAt, body, publishedAt, ...rest } = dto;
    const data: Prisma.StoryUncheckedUpdateManyInput = { ...rest };
    if (body !== undefined) {
      data.body = parseBlocks(body);
    }
    if (publishedAt !== undefined) data.publishedAt = new Date(publishedAt);

    // Read before the write, so the *previous* copy is the one kept. Cheap —
    // three columns by primary key — and only used if the write below turns
    // out to have happened.
    const before = await this.prisma.story.findUnique({
      where: { id },
      select: { title: true, dek: true, body: true, status: true },
    });

    const updated = await updateWithOptimisticLock(
      this.prisma.story,
      id,
      expectedUpdatedAt,
      data,
      'Story not found.',
    );

    // After the lock, never before it. A revision written for a write that
    // was then refused as stale would be a history entry for something that
    // never happened — and it would be the entry a writer reached for.
    if (before) await this.snapshot(id, before);

    return updated;
  }

  /* ── History ─────────────────────────────────────────────────────────── */

  /**
   * Keeps the copy as it stood before an edit, so a paragraph can be got back.
   *
   * ── The problem this has to solve ────────────────────────────────────────
   * The editor autosaves. A revision per save would be a revision every few
   * seconds while somebody is writing a paragraph, which is not a history —
   * it is a keystroke log with a thousand entries between "before lunch" and
   * "after lunch", and the one a writer wants is unfindable in it.
   *
   * ── The rule ─────────────────────────────────────────────────────────────
   * At most one revision per story per ten minutes, except that a published
   * piece always gets one. Two different reasons:
   *
   *   * Ten minutes is roughly the granularity of "what did this look like
   *     earlier". Finer than that and the list is noise; coarser and an
   *     afternoon of work has two entries in it.
   *
   *   * A live piece is different in kind. Editing something readers can
   *     already see is a correction, and what the piece said before a
   *     correction is a fact about the published record — not a convenience.
   *     Those are never collapsed into a ten-minute bucket.
   *
   * Nothing is written when the words did not change. A save that only moved
   * the beat or the cover would otherwise produce a revision identical to the
   * one before it, and a history of identical entries is a history nobody
   * reads twice.
   *
   * ── Best effort ──────────────────────────────────────────────────────────
   * A failure here is swallowed. The edit itself has already committed; a
   * writer whose save succeeded should not be told it failed because the
   * history could not be appended to, and the alternative — failing the
   * request — would lose the words to protect a copy of them.
   */
  private async snapshot(
    storyId: string,
    before: { title: string; dek: string; body: Prisma.JsonValue; status: StoryStatus },
  ): Promise<void> {
    try {
      const latest = await this.prisma.storyRevision.findFirst({
        where: { storyId },
        orderBy: { createdAt: 'desc' },
        select: { title: true, dek: true, body: true, createdAt: true },
      });

      if (latest) {
        const unchanged =
          latest.title === before.title &&
          latest.dek === before.dek &&
          JSON.stringify(latest.body) === JSON.stringify(before.body);
        if (unchanged) return;

        const recent = Date.now() - latest.createdAt.getTime() < REVISION_INTERVAL_MS;
        if (recent && before.status !== StoryStatus.PUBLISHED) return;
      }

      await this.prisma.storyRevision.create({
        data: {
          storyId,
          title: before.title,
          dek: before.dek,
          // `Story.body` is non-nullable and every write goes through
          // `parseBlocks`, so a JSON null cannot legitimately be in there.
          // Read as an empty body rather than passed through, because that is
          // what an empty body is everywhere else in this codebase.
          body: (before.body ?? []) as Prisma.InputJsonValue,
        },
      });

      await this.prune(storyId);
    } catch (cause) {
      // Deliberately quiet in the response, loud in the log: this is the one
      // place a failure is invisible to the caller, so it must not be
      // invisible to whoever maintains the deployment.
      console.error(`[stories] Could not write a revision for ${storyId}:`, cause);
    }
  }

  /**
   * Keeps the newest `REVISION_LIMIT` and deletes the rest.
   *
   * A cap rather than an age, because what makes a history expensive is a
   * story being edited a great deal, not a story being old — and the piece
   * somebody is still working on years later is exactly the one whose history
   * should not have been swept up by a date.
   */
  private async prune(storyId: string): Promise<void> {
    const keep = await this.prisma.storyRevision.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      take: REVISION_LIMIT,
      select: { id: true },
    });

    await this.prisma.storyRevision.deleteMany({
      where: { storyId, id: { notIn: keep.map((row) => row.id) } },
    });
  }

  /**
   * The history of one story, newest first.
   *
   * Bodies included. A list of dates with no content is a list nobody can
   * choose from — "the version from Tuesday" means nothing until you can read
   * it — and the cap above bounds how much this can ever be.
   */
  async revisions(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'stories:write');
    const story = await this.prisma.story.findUnique({ where: { id }, select: { id: true } });
    if (!story) throw new NotFoundException('Story not found.');

    return this.prisma.storyRevision.findMany({
      where: { storyId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Putting a story in front of readers, taking it back down, or setting it to
   * appear later. The three-in-one the stub said had to land together.
   *
   * ── Why the scheduled transition is not a job ────────────────────────────
   * The obvious shape is a sweeper: a timer that wakes up, finds every
   * SCHEDULED story whose moment has passed, and flips it to PUBLISHED. This
   * service does not have one, and the omission is the design rather than the
   * part still missing.
   *
   * A sweeper makes the moment a piece becomes public depend on a background
   * process being alive. If it dies, or the container is recycled, or the
   * deployment runs two instances and both try, then "goes live at 6am" means
   * "goes live at 6am if the timer fired" — and the failure is silent, because
   * the writer finds out when a reader does not. Worse, the interval is the
   * error bar: a sweep every five minutes cannot honour a 6:00 embargo.
   *
   * So the clock does it instead. `publishedWhere` counts a SCHEDULED story
   * whose `publishedAt` has passed as public, which means the transition
   * happens at the instant, inside the query, with nothing to keep running and
   * no skew between two clocks. `promoteDueScheduled` below then tidies the
   * column so the admin list does not label a piece "scheduled" that readers
   * can already read — but it is bookkeeping, not the mechanism, and the site
   * is correct whether or not it has ever run.
   *
   * ── The date rule ────────────────────────────────────────────────────────
   * First publication sets `publishedAt`; every publication after it keeps
   * what is there. The date a piece ran is a fact about the piece, and a
   * re-publish after a correction is not a new piece. The alternative — stamp
   * `now()` on every transition — quietly re-dates work each time it is
   * touched, which on a journalism site is a false claim about when something
   * was reported.
   *
   * ── The un-publishing rule ───────────────────────────────────────────────
   * Status goes back to DRAFT and `publishedAt` is left exactly where it is,
   * for the reason above: pulling a piece is a statement about whether readers
   * may see it, not about when it ran. Putting it back later restores the
   * original date rather than inventing a second one.
   *
   * DRAFT rather than a fourth status. There is no `WITHDRAWN`, because
   * nothing in the product would treat one differently from a draft, and a
   * status nobody branches on is a column that drifts out of meaning.
   */
  async publish(
    principal: Principal | undefined,
    id: string,
    dto: PublishStoryDto = {},
  ): Promise<StoryWithStats> {
    this.policy.requireScope(principal, 'stories:publish');

    const action = dto.action ?? 'publish';
    const story = await this.prisma.story.findUnique({ where: { id } });
    if (!story) throw new NotFoundException('Story not found.');

    if (action === 'unpublish') {
      if (dto.publishAt !== undefined) {
        throw new BadRequestException(
          'publishAt has no meaning when un-publishing. Send it with action "schedule".',
        );
      }
      if (story.status === StoryStatus.DRAFT) {
        throw new BadRequestException('This piece is already a draft. There is nothing to take down.');
      }
      return this.transition(id, {
        // publishedAt deliberately untouched — see the un-publishing rule above.
        status: StoryStatus.DRAFT,
      });
    }

    // Both remaining verbs put the piece in front of readers, now or later, so
    // both are held to the same checks. A scheduled piece that fails them at
    // 6am fails with nobody watching, which is the worst time to find out.
    this.assertPublishable(story);

    if (action === 'schedule') {
      const when = this.futureInstant(dto.publishAt);
      return this.transition(id, { status: StoryStatus.SCHEDULED, publishedAt: when });
    }

    if (dto.publishAt !== undefined) {
      throw new BadRequestException(
        'publishAt has no meaning when publishing now. Send action "schedule" to set a date.',
      );
    }

    const now = new Date();
    return this.transition(id, {
      status: StoryStatus.PUBLISHED,
      // Kept when the piece already has a date in the past; set when it does
      // not. A `publishedAt` in the future belongs to a schedule the writer is
      // overriding by publishing now, so it is replaced rather than honoured —
      // otherwise "publish" would put a piece live with tomorrow's date on it
      // and `publishedWhere` would immediately hide it again.
      publishedAt: story.publishedAt && story.publishedAt <= now ? story.publishedAt : now,
    });
  }

  /**
   * The canonical check, written as refusals with the fix inside the sentence.
   *
   * Each one is wrong in a way a reader would see, and in a way that later
   * editing does not make retrospectively fine — a placeholder that ran for an
   * hour was still published template text. They are refusals rather than
   * warnings for exactly that reason: a warning on a publish button is a thing
   * people click past.
   *
   * What is deliberately *not* checked: slug collisions, because `Story.slug`
   * is unique in the database and a duplicate cannot exist to be caught; and
   * whether the genre exists, because the foreign key already guarantees it. A
   * check that cannot fail is documentation wearing a control's clothes.
   */
  private assertPublishable(story: {
    title: string;
    dek: string;
    body: Prisma.JsonValue;
    placeholder: boolean;
    sourceUrl: string | null;
  }): void {
    if (story.placeholder) {
      throw new UnprocessableEntityException(
        'This piece is still marked as placeholder — template text that shipped with the site. ' +
          'Clear the placeholder flag once it is real reporting, then publish.',
      );
    }

    if (!story.title.trim() || !story.dek.trim()) {
      throw new UnprocessableEntityException(
        'A published piece needs a headline and a standfirst. They are what a reader sees before they open it.',
      );
    }

    if (!Array.isArray(story.body) || story.body.length === 0) {
      throw new UnprocessableEntityException('There is nothing in the body to publish yet.');
    }

    /*
     * A syndicated piece points at the version its author maintains. If that
     * address is on this site, the copy is claiming to be its own original — a
     * canonical loop, which tells a search engine that two URLs are each the
     * authority for the other and leaves it to pick one.
     *
     * Checked only when APP_URL is configured. Without it there is no way to
     * know which origin is ours, and a guess would refuse a legitimate
     * syndication link on a deployment that was never told its own address.
     */
    const own = this.ownOrigin();
    if (own && story.sourceUrl && sameOrigin(story.sourceUrl, own)) {
      throw new UnprocessableEntityException(
        'The original-source URL points back at this site, which would make the piece its own canonical. ' +
          'Point it at where the piece first ran, or clear it.',
      );
    }
  }


  /**
   * Deleting a piece, which is only ever a draft.
   *
   * ── The rule, and the two questions it answers ───────────────────────────
   * The admin list has been carrying a comment saying there is no delete here,
   * and that its absence was a decision rather than an omission: removing the
   * row is the easy part of a choice that also has to say what the links
   * pointing at it become, and what the old public address says afterwards.
   * Both have answers now, and the second one is what makes the first cheap.
   *
   * **The old URL.** A DRAFT has no old URL. `publishedWhere` has never let a
   * draft reach a reader, so nothing has ever been served from `/stories/:slug`
   * for this row — there is no address in anybody's bookmarks, no entry in an
   * index, and deleting it changes precisely nothing a reader could observe.
   * Refusing anything that is not a draft is therefore not a limitation working
   * around a hard problem; it is the hard problem, removed. A writer who wants
   * a published piece gone takes it down first, and that transition is the one
   * that owes readers an answer — which is why it lives on `publish`, beside
   * the un-publishing rule, and not here.
   *
   * **The links.** Answered in the schema, row by row, and deliberately not
   * re-decided here. Revisions, stats, events, collection entries and the
   * `StorySource`/`StoryQuote`/`StoryInterview`/`StoryEvidence`/timeline joins
   * are `onDelete: Cascade` — they describe this story and mean nothing without
   * it. Ideas, pitches, notes and deadlines are `onDelete: SetNull` — they are
   * records of work that happened, they outlive the draft they were attached
   * to, and orphaning them keeps the reporting record while dropping a pointer
   * that no longer resolves. A service re-implementing any of that in
   * application code would be a second copy of a rule the database already
   * enforces, and the copy that drifts is always the one further from the data.
   *
   * ── Why `stories:publish` and not `stories:write` ────────────────────────
   * The same argument the publish route makes. `stories:write` is craft, and
   * the dev account holds it so an editor bug can be reproduced against a real
   * draft. Destroying a writer's unpublished work is not craft, and no amount
   * of software maintenance requires it.
   */
  async remove(
    principal: Principal | undefined,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    this.policy.requireScope(principal, 'stories:publish');

    const story = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!story) throw new NotFoundException('Story not found.');

    if (story.status !== StoryStatus.DRAFT) {
      /*
       * Phrased as the next step rather than as a rule, because the writer is
       * one click from being allowed — "Take it down" is a control on the same
       * screen. A refusal that only names the constraint leaves them to work
       * out for themselves that un-publishing is what unlocks this.
       */
      throw new BadRequestException(
        story.status === StoryStatus.SCHEDULED
          ? 'This piece is scheduled to go live. Cancel the schedule first, then delete it.'
          : 'This piece is published and has an address readers may hold. Take it down first, then delete it.',
      );
    }

    await this.prisma.story.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** A `publishAt` that is present, real, and actually still ahead of us. */
  private futureInstant(value: string | undefined): Date {
    if (!value) {
      throw new BadRequestException('Scheduling needs a publishAt date.');
    }
    const when = new Date(value);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('publishAt must be an ISO 8601 timestamp.');
    }
    if (when <= new Date()) {
      throw new BadRequestException(
        'That moment has already passed. Schedule a future date, or publish now.',
      );
    }
    return when;
  }

  /**
   * The write itself, and the one place `status` is allowed to move.
   *
   * No `expectedUpdatedAt`, and that is a departure from every other write in
   * this service worth stating. The optimistic lock exists because two windows
   * editing the same paragraph is a real and destructive race. This is not an
   * edit: it sets two columns nothing else writes, from a button that already
   * reflects the state it is acting on. Requiring a version token would mean a
   * writer who left the tab open over lunch gets a 409 on "publish" and has to
   * reload in order to press the same button to the same effect. The lock
   * protects words; there are no words here.
   */
  private transition(
    id: string,
    data: { status: StoryStatus; publishedAt?: Date },
  ): Promise<StoryWithStats> {
    return this.prisma.story.update({
      where: { id },
      data,
      include: { stats: true },
    });
  }

  /**
   * Bookkeeping: flips SCHEDULED rows whose moment has passed to PUBLISHED, so
   * the admin list stops calling a piece "scheduled" that readers can read.
   *
   * Safe to run from a read path because it is one narrow `updateMany` that
   * matches nothing on the overwhelming majority of calls, touches no column a
   * writer is editing, and is idempotent — two instances running it at once
   * arrive at the same state. Nothing depends on it having run; see the note
   * on `publish`.
   */
  async promoteDueScheduled(): Promise<number> {
    const { count } = await this.prisma.story.updateMany({
      where: { status: StoryStatus.SCHEDULED, publishedAt: { not: null, lte: new Date() } },
      data: { status: StoryStatus.PUBLISHED },
    });
    return count;
  }

  /** APP_URL without its trailing slash, or empty when it is not configured. */
  private ownOrigin(): string {
    return (this.config.get('APP_URL', { infer: true }) ?? '').replace(/\/+$/, '');
  }
}

/**
 * Whether a URL lives on the given origin.
 *
 * Parsed rather than compared as a prefix. `startsWith` would call
 * `https://vibevic.example.com.somewhere-else.test/x` our own site, and — the
 * direction that actually matters here — would miss `http://` against an
 * `https://` origin, letting a canonical loop through on the scheme alone.
 *
 * An unparseable URL is not ours. It cannot be, and `@IsUrl()` on the DTO
 * means it should not have reached the database at all; returning false leaves
 * the complaint to the validator that has something useful to say about it.
 */
function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}
