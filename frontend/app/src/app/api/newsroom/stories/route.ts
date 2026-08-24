import { isUnlocked } from "@/lib/newsroom-auth";
import type { StorySummary } from "@/data/types";

/**
 * The admin story list, fetched on the server so the API token stays there.
 *
 * The API's `/admin/stories` returns drafts and scheduled pieces, and it wants
 * a bearer token. That token cannot go anywhere the browser can read it, which
 * rules out calling the API directly from `data/api.ts` — a `NEXT_PUBLIC_`
 * credential is a published credential. So the credential lives here, in a
 * handler the browser can only ask, never inspect.
 *
 * ── Two locks, same as the pitch desk ────────────────────────────────────
 * The middleware matcher covers `/api/newsroom/:path*`, so this is already
 * gated by the time it runs. `isUnlocked` is the second check, for the same
 * reason it is there: a matcher is configuration, a route can be moved, and
 * the failure mode of getting either wrong is an unauthenticated window onto
 * unpublished work.
 */

export const dynamic = "force-dynamic";

const API_BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

/** Rows as the API's admin surface returns them: raw records, not a public view. */
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
  stats?: {
    views: number;
    reads: number;
    listens: number;
    avgListenSeconds: number;
  } | null;
}

const STATUS = {
  PUBLISHED: "published",
  SCHEDULED: "scheduled",
  DRAFT: "draft",
} as const;

/**
 * Database row to the shape the admin views are written against.
 *
 * Built field by field rather than spread-and-patch. The admin surface returns
 * whole records by design, so a spread here would forward every column the
 * table grows next — the same argument the API's own public views make, and it
 * applies to a proxy just as well.
 *
 * `body` is dropped: the list does not render articles, and shipping every
 * draft's full text to a browser to display a title is waste.
 */
function toSummary(row: AdminStoryRow): StorySummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    genre: row.genreSlug,
    tags: row.tags,
    status: STATUS[row.status],
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

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ message: "The newsroom is locked." }, { status: 401 });
  }

  const token = process.env.NEWSROOM_API_TOKEN;
  if (!token) {
    // 501, not 500: nothing has gone wrong, the credential was never set. An
    // operator reading this should go and configure it, not go bug-hunting.
    return Response.json(
      { message: "NEWSROOM_API_TOKEN is not configured, so the admin API cannot be reached." },
      { status: 501 },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/admin/stories`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (cause) {
    // The real reason goes to the server log. What comes back is a sentence a
    // journalist can act on, with no hostname or stack trace in it.
    console.error("[newsroom/stories]", cause);
    return Response.json(
      { message: "The API could not be reached. Nothing was changed." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    console.error(`[newsroom/stories] API returned ${response.status}`);
    return Response.json(
      {
        message:
          response.status === 401 || response.status === 403
            ? "The API rejected the newsroom credential. Check NEWSROOM_API_TOKEN."
            : "The API could not list stories.",
      },
      { status: 502 },
    );
  }

  try {
    const rows = (await response.json()) as AdminStoryRow[];
    return Response.json(rows.map(toSummary));
  } catch (cause) {
    console.error("[newsroom/stories]", cause);
    return Response.json({ message: "The API's answer could not be read." }, { status: 502 });
  }
}
