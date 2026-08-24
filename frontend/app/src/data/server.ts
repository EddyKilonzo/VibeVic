import "server-only";

import type { Award, Genre, Publication, Story, StorySummary } from "./types";

/**
 * Server-side reads.
 *
 * The browser client (`data/api.ts`) throws on failure so a view can show an
 * error state and offer a retry. This one does not, and the difference is
 * deliberate: these calls run inside `generateMetadata`, `sitemap.ts`,
 * `rss.xml` and page components, where a throw is not an error state a reader
 * can act on — it is a 500 for the whole route, or a failed production build.
 *
 * So every function here degrades. A failed fetch logs the reason server-side
 * and returns empty, which means:
 *
 *   * a build with the API down still completes, producing pages that fill in
 *     on the next revalidation rather than a build that fails at 3am;
 *   * a page renders its own empty state instead of a crash;
 *   * `generateStaticParams` yields nothing and every path falls through to
 *     on-demand rendering, which is exactly what it should do when the list of
 *     paths is unknown.
 *
 * The one thing it must never do is fabricate. Empty is honest — "we could not
 * read the archive" — where a bundled fallback copy would quietly serve
 * yesterday's content and look like success.
 */

const BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

/**
 * How long a server render may reuse a cached read.
 *
 * Sixty seconds rather than `no-store`: these pages are read far more often
 * than the archive changes, and revalidation keeps the site answering from
 * cache while an edit still appears within the minute. It also means a brief
 * API outage is invisible to readers rather than immediately fatal.
 */
const REVALIDATE_SECONDS = 60;

async function read<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      // 404 on a single article is ordinary — the caller turns it into
      // notFound(). Anything else is worth a line in the log.
      if (response.status !== 404) {
        console.error(`[data/server] GET ${path} -> ${response.status}`);
      }
      return fallback;
    }

    return (await response.json()) as T;
  } catch (cause) {
    console.error(`[data/server] GET ${path} failed:`, cause);
    return fallback;
  }
}

/** The beat tree. Pair with the helpers in `lib/taxonomy.ts`. */
export function getGenres(): Promise<Genre[]> {
  return read<Genre[]>("/genres", []);
}

/** Published work, newest first. Summaries — bodies come with the article. */
export function getStories(): Promise<StorySummary[]> {
  return read<StorySummary[]>("/stories", []);
}

/**
 * One article, with its body.
 *
 * Null for both "no such slug" and "the API could not be reached", which the
 * caller renders as `notFound()`. Those are genuinely different, and the
 * distinction belongs in the server log rather than in a reader's face: a
 * "temporarily unavailable" page for a URL that has never existed is worse
 * than a 404, and it is the 404 that is right far more often.
 */
export function getStory(slug: string): Promise<Story | null> {
  return read<Story | null>(`/stories/${encodeURIComponent(slug)}`, null);
}

export function getPublications(): Promise<Publication[]> {
  return read<Publication[]>("/publications", []);
}

export function getAwards(): Promise<Award[]> {
  return read<Award[]>("/awards", []);
}
