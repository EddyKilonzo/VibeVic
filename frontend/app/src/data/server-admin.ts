import "server-only";

import type { Story, StorySummary } from "./types";

/**
 * Server-side reads of the newsroom surface.
 *
 * Split from `data/server.ts` because these carry a credential and those do
 * not. Everything in this file sends `NEWSROOM_API_TOKEN`, so everything in it
 * can see drafts — and keeping that in a separate module makes it obvious in
 * an import line when a page has reached for the privileged reader.
 *
 * Callers must already be behind the newsroom gate. Every route that uses this
 * lives under `/admin`, which the middleware matcher covers; this file does not
 * re-check, because a data module that decides authorisation is a data module
 * somebody will call from the wrong place and believe they are safe.
 */

const BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

async function readAdmin<T>(path: string, fallback: T): Promise<T> {
  const token = process.env.NEWSROOM_API_TOKEN;
  if (!token) {
    console.error(`[data/server-admin] NEWSROOM_API_TOKEN is not set; ${path} not attempted.`);
    return fallback;
  }

  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      // Never cached. A draft is edited and re-read seconds later, and serving
      // a journalist a stale copy of their own work is how an edit gets lost.
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`[data/server-admin] GET ${path} -> ${response.status}`);
      }
      return fallback;
    }

    return (await response.json()) as T;
  } catch (cause) {
    console.error(`[data/server-admin] GET ${path} failed:`, cause);
    return fallback;
  }
}

/** Raw admin row, before it is shaped into the frontend's `Story`. */
interface AdminStoryRow {
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
  body: Story["body"];
  stats?: StorySummary["stats"] | null;
}

const STATUS = {
  PUBLISHED: "published",
  SCHEDULED: "scheduled",
  DRAFT: "draft",
} as const;

/**
 * One story for the editor — drafts included, body and all.
 *
 * Null when it does not exist or the API could not be reached; the workspace
 * treats that as "start a blank draft at this id", which is the right
 * behaviour for a brand-new piece and a survivable one for an outage.
 */
export async function getAdminStory(id: string): Promise<Story | null> {
  const row = await readAdmin<AdminStoryRow | null>(
    `/admin/stories/${encodeURIComponent(id)}`,
    null,
  );
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    genre: row.genreSlug,
    tags: row.tags,
    status: STATUS[row.status],
    publishedAt: row.publishedAt ?? "",
    updatedAt: row.updatedAt,
    readingMinutes: row.readingMinutes,
    featured: row.featured,
    placeholder: row.placeholder,
    publication: row.publication ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    cover: row.cover ?? undefined,
    body: row.body,
  };
}
