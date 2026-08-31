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

/**
 * Whether this process is a build server rather than somebody's machine.
 *
 * Vercel sets `VERCEL` on every build and every function invocation; `CI` is
 * the generic equivalent. Used for one decision only: whether a localhost API
 * address is a plausible setup or a certain misconfiguration.
 */
const ON_A_BUILD_SERVER = Boolean(process.env.VERCEL ?? process.env.CI);

/** Whether a URL points back at the machine making the request. */
function isLoopback(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    // Not a URL at all. The fetch below will fail with its own message, which
    // will be about the actual value rather than about this guess at it.
    return false;
  }
}

/**
 * The retry budget for the two reads a build cannot proceed without.
 *
 * The API sleeps when idle — that is what a Render free instance does — and a
 * deploy is precisely when nothing has been talking to it. A cold start takes
 * appreciably longer than a served request, so the first attempt from a build
 * is the one most likely in the whole system to time out, and the cost of that
 * is a failed deploy of a frontend that has nothing wrong with it.
 *
 * Four attempts across roughly two minutes, and both numbers appear in the
 * error message so a genuine outage still reads as one rather than as an
 * impatient build. Only the page-list reads spend this: `read()` above degrades
 * to empty and is called during ordinary renders, where waiting two minutes
 * would be a far worse answer than an empty section.
 */
const PARAM_FETCH_ATTEMPTS = 4;
const PARAM_FETCH_TIMEOUT_MS = 20_000;
/** Waited *between* attempts; one shorter than the number of attempts. */
const PARAM_FETCH_BACKOFF_MS = [5_000, 15_000, 30_000];
const PARAM_FETCH_BUDGET_SECONDS = Math.round(
  (PARAM_FETCH_ATTEMPTS * PARAM_FETCH_TIMEOUT_MS +
    PARAM_FETCH_BACKOFF_MS.reduce((total, wait) => total + wait, 0)) /
    1000,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One fetch, retried while the far end looks like it is still waking up.
 *
 * Retries a thrown fetch (refused, reset, timed out) and a 5xx, because both
 * are what a booting server looks like from here. A 4xx is not retried: it is
 * an answer, and asking again more slowly will not change it.
 */
async function fetchWithWakeUp(url: string): Promise<Response> {
  let lastCause: unknown;

  for (let attempt = 0; attempt < PARAM_FETCH_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const wait = PARAM_FETCH_BACKOFF_MS[attempt - 1] ?? 30_000;
      console.warn(
        `[data/server] ${url} did not answer (attempt ${attempt} of ${PARAM_FETCH_ATTEMPTS}); ` +
          `retrying in ${wait / 1000}s in case the API is starting up.`,
      );
      await sleep(wait);
    }

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(PARAM_FETCH_TIMEOUT_MS),
      });

      // Server-side failure: worth another go. Anything else — including a
      // 404 — is the caller's to interpret.
      if (response.status >= 500 && attempt < PARAM_FETCH_ATTEMPTS - 1) {
        lastCause = new Error(`${url} returned ${response.status}`);
        continue;
      }

      return response;
    } catch (cause) {
      lastCause = cause;
    }
  }

  throw lastCause;
}

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
   * Two states, not one, and the second is why this was rewritten. The
   * original test was only whether a variable had been *set*, on the reasoning
   * that pointing a production build at a local API is legitimate — it is what
   * `next build` does on a developer's machine. That reasoning is still right,
   * and it is still not the whole rule: a variable holding a localhost URL is
   * set, so the guard passed, the fetch went to 127.0.0.1 and the deploy died
   * with the exact ECONNREFUSED this block exists to replace. An `API_URL`
   * copied over from `.env.local` is the ordinary way to arrive there.
   *
   * So the localhost half of the test asks where the build is running rather
   * than refusing localhost outright. On Vercel or in CI there is no local API
   * and never will be; on a workstation there usually is, and a build step that
   * refuses to run there gets worked around rather than fixed.
   */
  if (process.env.NODE_ENV === "production" && (!CONFIGURED_BASE || (ON_A_BUILD_SERVER && isLoopback(BASE)))) {
    throw new Error(
      `Cannot build the page list: the build is reading the archive from ${BASE}, ` +
        "which is not an API this build can reach.\n" +
        `  API_URL             = ${process.env.API_URL ?? "(not set)"}\n` +
        `  NEXT_PUBLIC_API_URL = ${process.env.NEXT_PUBLIC_API_URL ?? "(not set)"}\n` +
        "Set NEXT_PUBLIC_API_URL to the deployed API including its /api path — the " +
        "reader-facing views call it from the browser and cannot read a server-only " +
        "variable, and next.config.ts names it in the Content-Security-Policy. Set " +
        "API_URL only to override that for server-side reads.",
    );
  }

  let response: Response;
  try {
    response = await fetchWithWakeUp(`${BASE}${path}`);
  } catch (cause) {
    // A build that dies on a bare TypeError leaves the address it tried out of
    // the message, which is the one fact needed to fix it.
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new Error(
      `Cannot build the page list: ${BASE}${path} ` +
        (timedOut ? "did not answer in time." : "could not be reached.") +
        ` Gave up after ${PARAM_FETCH_ATTEMPTS} attempts over about ${PARAM_FETCH_BUDGET_SECONDS}s.` +
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
