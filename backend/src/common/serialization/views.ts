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

export { iso };
