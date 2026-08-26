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

const CONFIGURED_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

const BASE = (CONFIGURED_BASE ?? "http://localhost:4000/api").replace(/\/+$/, "");

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
 * The same two reads, but throwing instead of degrading.
 *
 * For `generateStaticParams` only, and the distinction is the whole point.
 * Those routes set `dynamicParams = false`, so the list they return *is* the
 * set of pages that exist — anything outside it is a genuine 404. That makes an
 * empty list from a failed fetch catastrophic in a way it is nowhere else: the
 * build would succeed and every single article would 404.
 *
 * An empty archive is a legitimate state and still returns empty. An
 * unreachable API is not, and failing the build is much better than shipping a
 * site where nothing can be read.
 */
async function readOrThrow<T>(path: string): Promise<T> {
  /**
   * The misconfiguration this exists to name.
   *
   * `BASE` falls back to localhost so a developer can run the two halves side
   * by side without setting anything. On a build server that fallback is always
   * wrong, and what it produced was `ECONNREFUSED 127.0.0.1:4000` inside
   * "Failed to collect page data for /beats/[slug]" — a route, a port and no
   * cause, which sends whoever reads it looking for a bug in the beats page.
   *
   * The test is whether the variable was *set*, not whether it points at
   * localhost. Pointing a production build at a local API is a legitimate thing
   * to do — it is what `next build` does on a developer's machine — and
   * refusing it would break the one command most likely to catch this class of
   * problem before a deploy does.
   */
  if (process.env.NODE_ENV === "production" && !CONFIGURED_BASE) {
    throw new Error(
      `Cannot build the page list: neither API_URL nor NEXT_PUBLIC_API_URL is set, so the ` +
        `build fell back to ${BASE}. Set one to the deployed API — and set ` +
        "NEXT_PUBLIC_API_URL regardless, since the reader-facing views call it from the " +
        "browser and cannot read a server-only variable.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    // A build that dies on a bare TypeError leaves the address it tried out of
    // the message, which is the one fact needed to fix it.
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new Error(
      `Cannot build the page list: ${BASE}${path} ` +
        (timedOut ? "did not answer in time." : "could not be reached.") +
        " The API must be running and reachable from the build for the archive to be generated.",
      { cause },
    );
  }

  if (!response.ok) {
    throw new Error(`GET ${path} returned ${response.status} while building the page list.`);
  }
  return (await response.json()) as T;
}

export function getStoriesForParams(): Promise<StorySummary[]> {
  return readOrThrow<StorySummary[]>("/stories");
}

export function getGenresForParams(): Promise<Genre[]> {
  return readOrThrow<Genre[]>("/genres");
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
