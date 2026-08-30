import type {
  Award,
  Collection,
  CollectionStory,
  Genre,
  Publication,
  Story,
  StoryStats,
} from '@prisma/client';
import { parseStoredBlocks, type StoryBlock } from '../content/story-block';
import { definePublicView, iso, isoRequired } from './public-view';

/**
 * Every public view in one file, so the complete list of things a reader can
 * ever receive is a page long and reviewable in one sitting. There is no view
 * for a Source, a Quote, an Interview, an Idea or a Note, and that absence is
 * load-bearing: without a view there is no way to put one on a public route.
 */

/* ── Stories ───────────────────────────────────────────────────────────── */

export type StoryWithStats = Story & { stats?: StoryStats | null };

export interface PublicStory {
  id: string;
  slug: string;
  title: string;
  dek: string;
  genre: string;
  tags: string[];
  status: 'published';
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  featured: boolean;
  placeholder: boolean;
  publication?: string;
  /** The piece at its original home, for syndicated work. */
  sourceUrl?: string;
  /** Real cover photograph. Absent means the reader gets generated art. */
  cover?: string;
  body: StoryBlock[];
  stats?: {
    views: number;
    reads: number;
    listens: number;
    avgListenSeconds: number;
  };
}

export const StoryPublicView = definePublicView<StoryWithStats, PublicStory>(
  'StoryPublicView',
  (story) => {
    // Defence in depth against a query that forgot its status filter. The view
    // is the last component that can tell a draft from a published piece, and
    // an unpublished draft reaching a reader is the same failure as a leaked
    // note — someone's unfinished words in public.
    if (story.status !== 'PUBLISHED' || story.publishedAt === null) {
      throw new Error(
        `StoryPublicView refused story ${story.id}: status=${story.status}. ` +
          `Public reads must filter to published stories in the query.`,
      );
    }

    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      dek: story.dek,
      genre: story.genreSlug,
      tags: story.tags,
      status: 'published',
      publishedAt: isoRequired(story.publishedAt),
      updatedAt: isoRequired(story.updatedAt),
      readingMinutes: story.readingMinutes,
      featured: story.featured,
      placeholder: story.placeholder,
      publication: story.publication ?? undefined,
      sourceUrl: story.sourceUrl ?? undefined,
      cover: story.cover ?? undefined,
      body: parseStoredBlocks(story.body),
      stats: story.stats
        ? {
            views: story.stats.views,
            reads: story.stats.reads,
            listens: story.stats.listens,
            avgListenSeconds: story.stats.avgListenSeconds,
          }
        : undefined,
    };
  },
);

/**
 * Index/card view. Separate from the full view rather than a flag on it,
 * because a listing endpoint has no business shipping every article body and
 * "same view, fewer fields" invariably drifts into "same view, all fields".
 */
export type PublicStorySummary = Omit<PublicStory, 'body' | 'stats'>;

export const StorySummaryPublicView = definePublicView<StoryWithStats, PublicStorySummary>(
  'StorySummaryPublicView',
  (story) => {
    const { body: _body, stats: _stats, ...summary } = StoryPublicView.project(story);
    return summary;
  },
);

/* ── Taxonomy and credits ──────────────────────────────────────────────── */

export interface PublicGenre {
  slug: string;
  name: string;
  description: string;
  /** The beat this subject sits under. Absent on the six top-level beats. */
  parent?: string;
}

export const GenrePublicView = definePublicView<Genre, PublicGenre>(
  'GenrePublicView',
  (genre) => ({
    slug: genre.slug,
    name: genre.name,
    description: genre.description,
    parent: genre.parentSlug ?? undefined,
  }),
);

export interface PublicPublication {
  name: string;
  role: string;
  period: string;
  description: string;
  url?: string;
}

export const PublicationPublicView = definePublicView<Publication, PublicPublication>(
  'PublicationPublicView',
  (publication) => ({
    name: publication.name,
    role: publication.role,
    period: publication.period,
    description: publication.description,
    url: publication.url ?? undefined,
  }),
);

export interface PublicAward {
  year: string;
  title: string;
  body: string;
  description: string;
  result: string;
}

export const AwardPublicView = definePublicView<Award, PublicAward>(
  'AwardPublicView',
  (award) => ({
    year: award.year,
    title: award.title,
    body: award.body,
    description: award.description,
    result: award.result,
  }),
);

/* ── Curation ──────────────────────────────────────────────────────────── */

export type CollectionWithStories = Collection & {
  stories: (CollectionStory & { story: Pick<Story, 'id' | 'slug' | 'status'> })[];
};

export interface PublicCollection {
  id: string;
  title: string;
  description: string;
  /** Ordered — the order is the curation. */
  storySlugs: string[];
  coverStoryId?: string;
}

export const CollectionPublicView = definePublicView<
  CollectionWithStories,
  PublicCollection
>('CollectionPublicView', (collection) => ({
  id: collection.id,
  title: collection.title,
  description: collection.description,
  // Unpublished members are dropped rather than listed as slugs a reader
  // cannot open: a collection is allowed to contain work in progress, and
  // naming that work in public would announce an unpublished investigation.
  storySlugs: [...collection.stories]
    .sort((a, b) => a.position - b.position)
    .filter((entry) => entry.story.status === 'PUBLISHED')
    .map((entry) => entry.story.slug),
  coverStoryId: collection.coverStoryId ?? undefined,
}));

/* ── Reader events ─────────────────────────────────────────────── */

/**
 * The acknowledgement a reader's browser gets for reporting an event.
 *
 * One boolean, and it is `accepted` rather than `counted` — those are different
 * facts and only the first is any of the browser's business. An event can be
 * accepted and then not counted: a repeat inside the same day is absorbed by
 * the unique index, and a request that smells like a crawler is dropped. Saying
 * "counted" would be a lie in both cases, and saying *which* would turn this
 * into an endpoint that reports on the filter it is subject to.
 *
 * Declared as a view for the same reason every other public response is: the
 * interceptor projects through it, so this route cannot start returning a view
 * count because somebody returned the wrong object from the service.
 */
export interface PublicEventAck {
  accepted: boolean;
}

export const EventAckPublicView = definePublicView<PublicEventAck, PublicEventAck>(
  'EventAckPublicView',
  (ack) => ({ accepted: ack.accepted }),
);

/* ── Health ────────────────────────────────────────────────────────────── */

export interface PublicHealth {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checkedAt: string;
}

export const HealthPublicView = definePublicView<PublicHealth, PublicHealth>(
  'HealthPublicView',
  (health) => ({
    status: health.status,
    uptimeSeconds: health.uptimeSeconds,
    checkedAt: health.checkedAt,
  }),
);

/* ── Sessions ──────────────────────────────────────────────────────────── */

/**
 * What a sign-in is allowed to hand back.
 *
 * ── Why the sign-in routes are on the public surface at all ──────────────
 * They have to be. A route that requires a token in order to obtain a token
 * is a door that opens from the inside, which is what `@NewsroomOnly` on
 * `POST /auth/token` used to mean while issuance threw anyway. Marking them
 * public is therefore a real widening of the unauthenticated surface, and
 * these views are the price: whatever the service returns is discarded and
 * this projection is sent instead.
 *
 * ── The shape is declared here, not imported ─────────────────────────────
 * `common/` does not import feature modules — the same rule `TokenVerifier`
 * follows — so the input is described structurally rather than pulled in
 * from `AuthService`. The cost is that the two definitions have to agree;
 * the benefit is that the serialisation layer stays a leaf.
 *
 * `role` and `scopes` go to the browser deliberately. The client needs them
 * to decide what to draw, and neither is a secret: what a WRITER may do is
 * in `roles.ts` for anyone to read. They are never what the server trusts —
 * every request is re-checked against the database (`AuthService.verifyJwt`).
 */
export interface PublicSession {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    scopes: string[];
  };
}

export const SessionPublicView = definePublicView<PublicSession, PublicSession>(
  'SessionPublicView',
  (session) => ({
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      // Copied, not passed through: the caller's array must not become part
      // of the response object it handed us.
      scopes: [...session.user.scopes],
    },
  }),
);

/**
 * The answer to "email me a way back in", and to spending a reset link.
 *
 * One boolean, and it is always `true`. That is not laziness — it is the
 * whole security property of the endpoint written into its return type. A
 * reset request must answer identically whether or not the address has an
 * account, so there is nothing for the response to vary with, and a shape
 * that *cannot* carry a difference is a stronger guarantee than a handler
 * that remembers not to.
 */
export interface PublicAccepted {
  accepted: true;
}

export const AcceptedPublicView = definePublicView<unknown, PublicAccepted>(
  'AcceptedPublicView',
  () => ({ accepted: true }),
);

export { iso };
