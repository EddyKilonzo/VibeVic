import "server-only";

import type { Block, Story, StorySummary } from "@/data/types";

/**
 * The two vocabularies a story is spelled in, and the translation between them.
 *
 * The API speaks Prisma's: `genreSlug`, `status: "DRAFT"`, `null` for an absent
 * value. The app speaks its own: `genre`, `status: "draft"`, `undefined`. This
 * is the same split `newsroom-records.ts` already draws for the eleven record
 * collections, made once here for stories rather than a fourth time inside each
 * route handler that touches one.
 *
 * It is `server-only` for the reason every module in this family is: the
 * translation sits on the server side of the proxy so a Prisma enum never
 * reaches the browser, and a client import would quietly move that boundary.
 */

/** A story as the API's admin surface returns it: a raw row, not a public view. */
export interface AdminStoryRow {
  id: string;
  slug: string;
  title: string;
  dek: string;
  genreSlug: string;
  tags: string[];
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
  featured: boolean;
  placeholder: boolean;
  publication: string | null;
  sourceUrl: string | null;
  cover: string | null;
  body?: Block[];
  stats?: StorySummary["stats"] | null;
}

const TO_APP = {
  PUBLISHED: "published",
  SCHEDULED: "scheduled",
  DRAFT: "draft",
} as const;

/**
 * Row → summary, for the list.
 *
 * Built field by field rather than spread-and-patch. The admin surface returns
 * whole records by design, so a spread here would forward every column the
 * table grows next — the same argument the API's own public views make, and it
 * applies to a proxy just as well.
 *
 * `body` is dropped: the list does not render articles, and shipping every
 * draft's full text to a browser to display a title is waste.
 */
export function toSummary(row: AdminStoryRow): StorySummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    genre: row.genreSlug,
    tags: row.tags,
    status: TO_APP[row.status],
    // Empty for a piece with no date yet. Nothing in the admin list renders
    // this; inventing "now" would put a publication date on an unpublished
    // draft, which is the one wrong answer available.
    publishedAt: row.publishedAt ?? "",
    updatedAt: row.updatedAt,
    readingMinutes: row.readingMinutes,
    featured: row.featured,
    placeholder: row.placeholder,
    publication: row.publication ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    cover: row.cover ?? undefined,
    stats: row.stats ?? undefined,
  };
}

/** Row → the full story, body included. For the editor and for one-story reads. */
export function toStory(row: AdminStoryRow): Story {
  return { ...toSummary(row), body: row.body ?? [] };
}

/**
 * What a create is allowed to send.
 *
 * Narrower than `Story` on purpose. `id`, `updatedAt` and `stats` are the
 * server's to decide, and `forbidNonWhitelisted` on the API turns an
 * unrecognised property into a 400 rather than ignoring it — so sending the
 * whole object back would fail on the fields the editor never touched.
 */
interface ApiStoryWrite {
  title: string;
  slug?: string;
  dek: string;
  genreSlug: string;
  tags: string[];
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  publishedAt?: string;
  readingMinutes: number;
  featured: boolean;
  placeholder: boolean;
  publication?: string;
  sourceUrl?: string;
  cover?: string;
  body: Block[];
  expectedUpdatedAt?: string;
}

/**
 * An optional string field, sent only when it carries something.
 *
 * The empty string is not the same as absent to the API: `sourceUrl` is
 * validated with `@IsUrl()`, so `""` is a 400 rather than "no source URL". The
 * editor produces empty strings freely — a cleared input is `""`, not
 * `undefined` — so the flattening happens here rather than in six call sites.
 */
function present(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * A date the API will accept, or nothing.
 *
 * The editor holds `publishedAt` as `YYYY-MM-DD`, which `@IsISO8601()` accepts
 * but `new Date()` reads as midnight UTC. That is fine for a publication date
 * and wrong for nothing here. What is worth guarding is the empty string, which
 * an unpublished draft carries and which would arrive as `Invalid Date`.
 */
function isoOrNothing(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return Number.isNaN(new Date(trimmed).getTime()) ? undefined : trimmed;
}

function common(story: Story): Omit<ApiStoryWrite, "slug" | "status" | "expectedUpdatedAt"> {
  return {
    title: story.title,
    dek: story.dek,
    genreSlug: story.genre,
    tags: story.tags ?? [],
    publishedAt: isoOrNothing(story.publishedAt),
    readingMinutes: story.readingMinutes,
    featured: story.featured ?? false,
    placeholder: story.placeholder ?? false,
    publication: present(story.publication),
    sourceUrl: present(story.sourceUrl),
    cover: present(story.cover),
    body: story.body,
  };
}

/**
 * Story → the create payload.
 *
 * The slug is required, and is set once, here — see `slugFor` in the route.
 *
 * The status is `DRAFT` regardless of what the editor holds, and that is not a
 * default being applied for tidiness. `publishedWhere` on the API makes a story
 * public on exactly two columns, `status` and `publishedAt`, so a create that
 * forwarded the editor's status could put a piece on the site with one request
 * — bypassing the transition the API has deliberately not implemented yet. A
 * brand-new record is a draft; there is no case where it is anything else.
 */
export function toApiCreate(story: Story, slug: string): ApiStoryWrite {
  return { ...common(story), slug, status: "DRAFT" };
}

/**
 * Story → the update payload.
 *
 * No slug, and that is the API's rule rather than an omission: `UpdateStoryDto`
 * does not declare one, so sending it would be rejected outright. A story's
 * address is fixed at creation, because changing it silently breaks every link
 * a reader has already saved and every canonical URL already in an index.
 *
 * ── No status either, and this one is a deliberate refusal ──────────────
 * A PATCH carrying `status: "PUBLISHED"` alongside a `publishedAt` in the past
 * satisfies the API's `publishedWhere` exactly. That is the whole of what it
 * takes to make a piece public — which is precisely why it must not be
 * reachable from the editor's autosave, where it would happen as a side effect
 * of typing.
 *
 * The route this used to defer to could not publish at all, and the refusal
 * stands unchanged now that it can. `/admin/stories/:id/publish` runs the
 * canonical check, applies the date rule and is the one place `status` moves;
 * a second path to the same two columns would be a second way to put something
 * in front of readers, and only one of them would have the checks. So the
 * editor writes what a writer writes — words, pictures, the beat it is filed
 * under — and the decision goes through the route that decides.
 *
 * `expectedUpdatedAt` is mandatory here. The API compares it inside a
 * conditional UPDATE and answers 409 when it has moved on, which is the whole
 * reason a second tab cannot quietly overwrite the first.
 */
export function toApiUpdate(
  story: Story,
  expectedUpdatedAt: string,
): Omit<ApiStoryWrite, "status"> {
  return { ...common(story), expectedUpdatedAt };
}
