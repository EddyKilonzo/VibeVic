/* eslint-disable no-console */
import { Prisma, PrismaClient, StoryStatus } from '@prisma/client';
import { z } from 'zod';
import { blockArraySchema } from '../src/common/content/story-block';
import snapshot from './seed-data/content.json';

/**
 * Loads the site's real content into the database.
 *
 * Two properties this has to have, and both are about not destroying work:
 *
 *   * It is idempotent. Every write is an upsert keyed on something stable —
 *     a genre's slug, a story's id, a derived id for the tables that have no
 *     natural key — so running it twice produces the same database rather than
 *     a second copy of the archive.
 *   * It never deletes. A `deleteMany` here would be simpler, and would also
 *     mean that the day someone edits a story in the admin and a deploy re-runs
 *     the seed, their edit is gone. Rows this file does not know about are left
 *     alone.
 *
 * What it deliberately does not create: StoryStats rows, and accounts. Zeroed
 * counters would put "0 views" on the public API for articles nobody has
 * measured, and absent means "not measured", which is the truth.
 *
 * Accounts are out for a different reason. They used to be furniture — no code
 * path read a User row. Now sign-in does, which makes creating one a decision
 * about who may enter the newsroom, and a decision like that should not be a
 * side effect of a deploy re-running the seed. It has its own command that a
 * person invokes on purpose: `npm run account -- add`, in prisma/accounts.ts.
 *
 * Input is prisma/seed-data/content.json, written by export-content.js from
 * frontend/app/src/data/content.ts. It is validated here rather than trusted:
 * it is generated, but it is also a file on disk that a person can edit.
 */

/* ── The shape the seed will accept ────────────────────────────────────── */

const genreSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  parent: z.string().min(1).optional(),
});

const storySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  dek: z.string(),
  genre: z.string().min(1),
  tags: z.array(z.string()).default([]),
  status: z.enum(['published', 'draft', 'scheduled']),
  publishedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  readingMinutes: z.number().int().nonnegative(),
  featured: z.boolean().optional(),
  placeholder: z.boolean().optional(),
  publication: z.string().optional(),
  sourceUrl: z.string().optional(),
  cover: z.string().optional(),
  // The same schema the API validates writes and public reads against. If the
  // imported archive does not satisfy it, that is worth knowing at seed time
  // rather than on the first request for the article.
  body: blockArraySchema,
});

const publicationSchema = z.object({
  name: z.string().min(1),
  role: z.string(),
  period: z.string(),
  description: z.string(),
  url: z.string().optional(),
});

const awardSchema = z.object({
  year: z.string(),
  title: z.string(),
  body: z.string(),
  description: z.string(),
  result: z.string(),
});

const snapshotSchema = z.object({
  generatedAt: z.string(),
  generatedFrom: z.string(),
  genres: z.array(genreSchema).min(1),
  stories: z.array(storySchema).min(1),
  publications: z.array(publicationSchema),
  // Empty on purpose — nothing has been confirmed. See content.ts.
  awards: z.array(awardSchema),
});

type Snapshot = z.infer<typeof snapshotSchema>;
type SeedGenre = z.infer<typeof genreSchema>;
type SeedStatus = Snapshot['stories'][number]['status'];

/* ── Helpers ───────────────────────────────────────────────────────────── */

class SeedError extends Error {}

/**
 * Stable id for the two tables with no natural key.
 *
 * Publications and awards are keyed on cuid() in the schema, which is right for
 * rows created through an admin and useless for a seed that has to recognise
 * the row it wrote last time. Deriving the id from the content gives the upsert
 * something to match on, without adding a unique constraint to the schema that
 * would exist only to serve this file.
 */
function derivedId(prefix: string, ...parts: string[]): string {
  const slug = parts
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${prefix}_${slug}`;
}

const STATUS: Record<SeedStatus, StoryStatus> = {
  published: StoryStatus.PUBLISHED,
  draft: StoryStatus.DRAFT,
  scheduled: StoryStatus.SCHEDULED,
};

function parseDate(value: string, what: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new SeedError(`${what} is not a date this can read: "${value}".`);
  }
  return date;
}

/**
 * Parents before children.
 *
 * genres.parentSlug is a real foreign key, so inserting a subject before the
 * beat it sits under fails. Sorting by whether a row has a parent is enough
 * because the taxonomy is exactly two levels deep and the data model has
 * nothing that would let it become three — a general topological sort here
 * would be code defending against a shape that cannot occur.
 */
function parentsFirst(genres: SeedGenre[]): SeedGenre[] {
  return [...genres].sort(
    (a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)),
  );
}

/** Checks the snapshot is self-consistent before a single row is written. */
function assertReferencesResolve(data: Snapshot): void {
  const slugs = new Set(data.genres.map((genre) => genre.slug));
  const problems: string[] = [];

  for (const genre of data.genres) {
    if (genre.parent && !slugs.has(genre.parent)) {
      problems.push(
        `genre "${genre.slug}" is filed under "${genre.parent}", which does not exist`,
      );
    }
    if (genre.parent === genre.slug) {
      problems.push(`genre "${genre.slug}" is its own parent`);
    }
  }

  for (const story of data.stories) {
    if (!slugs.has(story.genre)) {
      problems.push(
        `story "${story.slug}" is filed under beat "${story.genre}", which does not exist`,
      );
    }
    // The public view refuses a published story with no date, which would turn
    // every read of it into a 500. Better to refuse to seed it.
    if (story.status === 'published' && !story.publishedAt) {
      problems.push(`story "${story.slug}" is published but carries no publishedAt`);
    }
  }

  const seen = new Map<string, string>();
  for (const story of data.stories) {
    const clash = seen.get(story.slug);
    if (clash) {
      problems.push(
        `stories "${clash}" and "${story.id}" share the slug "${story.slug}"`,
      );
    }
    seen.set(story.slug, story.id);
  }

  if (problems.length > 0) {
    throw new SeedError(
      `The content snapshot does not hang together:\n` +
        problems.map((problem) => `    - ${problem}`).join('\n'),
    );
  }
}

/* ── The seed ──────────────────────────────────────────────────────────── */

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function seed(data: Snapshot): Promise<void> {
  console.log(`  reading ${data.generatedFrom} (exported ${data.generatedAt})`);

  for (const genre of parentsFirst(data.genres)) {
    const fields = {
      name: genre.name,
      description: genre.description,
      parentSlug: genre.parent ?? null,
    };
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      create: { slug: genre.slug, ...fields },
      update: fields,
    });
  }
  console.log(`  genres          ${data.genres.length}`);

  for (const story of data.stories) {
    const fields = {
      slug: story.slug,
      title: story.title,
      dek: story.dek,
      genreSlug: story.genre,
      tags: story.tags,
      status: STATUS[story.status],
      publishedAt: parseDate(story.publishedAt, `story "${story.slug}" publishedAt`),
      readingMinutes: story.readingMinutes,
      featured: story.featured ?? false,
      placeholder: story.placeholder ?? false,
      publication: story.publication ?? null,
      sourceUrl: story.sourceUrl ?? null,
      cover: story.cover ?? null,
      body: story.body,
    };
    // The original id is kept rather than letting cuid() mint a new one: it is
    // what the imported archive calls the piece, and anything already pointing
    // at "w-155" should keep pointing at the same article.
    await prisma.story.upsert({
      where: { id: story.id },
      create: { id: story.id, ...fields },
      update: fields,
    });
  }
  console.log(`  stories         ${data.stories.length}`);

  for (const publication of data.publications) {
    const fields = {
      name: publication.name,
      role: publication.role,
      period: publication.period,
      description: publication.description,
      url: publication.url ?? null,
    };
    const id = derivedId('pub', publication.name, publication.period);
    await prisma.publication.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
  }
  console.log(`  publications    ${data.publications.length}`);

  for (const award of data.awards) {
    const fields = {
      year: award.year,
      title: award.title,
      body: award.body,
      description: award.description,
      result: award.result,
    };
    const id = derivedId('award', award.year, award.title);
    await prisma.award.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
  }
  console.log(`  awards          ${data.awards.length}`);
}

/**
 * Everything below is about failing legibly.
 *
 * A seed that dies on a stack trace sends whoever ran it into Prisma's source.
 * The three failures that actually happen — a snapshot that does not validate,
 * content that contradicts itself, a database that is not reachable — each get
 * a message saying which one it was and what to do about it.
 */
async function main(): Promise<void> {
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new SeedError(
      `prisma/seed-data/content.json does not match what the seed expects:\n` +
        parsed.error.issues
          .map((issue) => `    - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('\n') +
        `\n  Re-run "npm run db:export-content" to regenerate it from the frontend.`,
    );
  }

  assertReferencesResolve(parsed.data);
  await seed(parsed.data);
}

main()
  .then(() => console.log('\n  Seed complete.\n'))
  .catch((error: unknown) => {
    if (error instanceof SeedError) {
      console.error(`\n  x ${error.message}\n`);
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error(
        `\n  x Could not reach the database.\n` +
          `    ${error.message.split('\n')[0]}\n` +
          `    Check DATABASE_URL in backend/.env, and that the Neon project is awake.\n`,
      );
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const detail = error.message.trim().split('\n').slice(-1)[0] ?? error.message;
      console.error(
        `\n  x The database refused a write (${error.code}).\n` +
          `    ${detail}\n` +
          `    P2021/P2022 means the migration has not been applied: run "npm run prisma:deploy".\n`,
      );
    } else {
      console.error('\n  x The seed failed.\n');
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    // Always, including on the failure paths above — otherwise a failed seed
    // leaves a connection open against Neon until it times out.
    void prisma.$disconnect();
  });
