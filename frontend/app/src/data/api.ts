import { inGenre } from "@/lib/taxonomy";
import type { Award, Genre, Publication, Story, StorySummary } from "./types";

/**
 * The content API.
 *
 * This file used to resolve the seed arrays behind a `setTimeout`, with a note
 * saying that wiring a real backend would be a change to this file alone. This
 * is that change: every read below now goes to the NestJS API, which reads
 * Postgres. The loading and error states in the views were always real code
 * paths, which is why none of them had to change when the network appeared.
 *
 * ── What this file does not fetch ────────────────────────────────────────
 * `content.ts` now holds only the journalist's own details — profile, contact,
 * social accounts — which are site chrome rather than content rows and have no
 * table behind them. Everything the archive is made of comes from here.
 */

/**
 * Where the API answers.
 *
 * `NEXT_PUBLIC_` because these calls are made from the browser: the views that
 * use them are client components. That prefix is also why nothing secret can
 * live in this file — anything here ships in the bundle. The admin read is the
 * exception and is routed through a server handler for exactly that reason.
 */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/+$/, "");

/** Long enough for a cold Neon connection, short enough that a hang is visible. */
const TIMEOUT_MS = 15_000;

/**
 * A failed read, carrying what the UI needs to say something true.
 *
 * `status` is null when the request never reached the server at all — a
 * distinction worth keeping, because "the API is down" and "the API said no"
 * lead a reader to different conclusions and a developer to different files.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pulls the server's own message out of a Nest error body, if there is one. */
async function messageFrom(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join("; ");
    }
  } catch {
    // A non-JSON error body is normal for a proxy or a gateway timeout. The
    // status alone is still worth reporting, so this is not a failure.
  }
  return null;
}

async function get<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
      // Reads are live. Next would otherwise cache these on the server and
      // serve an article that has since been edited.
      cache: "no-store",
    });
  } catch (cause) {
    // fetch rejects for exactly two reasons worth telling apart: the deadline
    // passed, or the connection never happened.
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new ApiError(
      timedOut
        ? "The server took too long to answer. It may be waking up — try again."
        : "Could not reach the server. Check your connection, or that the API is running.",
      null,
      path,
    );
  }

  if (!response.ok) {
    const detail = await messageFrom(response);
    throw new ApiError(
      response.status === 404
        ? (detail ?? "That is not here.")
        : (detail ?? `The server returned ${response.status}.`),
      response.status,
      path,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("The server's answer could not be read.", response.status, path);
  }
}

export const api = {
  /** Published work, newest first. Summaries — bodies come with the article. */
  stories: (): Promise<StorySummary[]> => get<StorySummary[]>("/stories"),

  story: (slug: string): Promise<Story> =>
    get<Story>(`/stories/${encodeURIComponent(slug)}`),

  /**
   * Everything filed under a beat, including the subjects beneath it.
   *
   * The API's own `/stories/genre/:slug` matches one slug exactly, which would
   * make a parent beat like News look empty while Kenya and Africa carried all
   * its work. Filtering the list through `inGenre` keeps one definition of what
   * a beat contains, shared with the archive filters and the beat pages.
   */
  byGenre: async (slug: string): Promise<StorySummary[]> => {
    // Both reads, because "everything under News" needs the tree as well as
    // the archive — the beat a story is filed under may be a child of the one
    // being asked for.
    const [stories, genres] = await Promise.all([api.stories(), api.genres()]);
    return stories.filter((story) => inGenre(genres, story.genre, slug));
  },

  /**
   * Substring search over titles, deks and tags.
   *
   * Short queries are answered locally with an empty list rather than sent: the
   * API requires two characters and would return a 400, which would surface to
   * someone who has simply not finished typing yet.
   */
  search: (query: string): Promise<StorySummary[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return Promise.resolve([]);
    return get<StorySummary[]>(`/stories/search?q=${encodeURIComponent(trimmed)}`);
  },

  genres: (): Promise<Genre[]> => get<Genre[]>("/genres"),

  publications: (): Promise<Publication[]> => get<Publication[]>("/publications"),

  awards: (): Promise<Award[]> => get<Award[]>("/awards"),

  /**
   * Admin: drafts and scheduled pieces included.
   *
   * Same-origin, and deliberately not a call to the API's `/admin/stories`.
   * That route needs a bearer token, and a token reachable from this file would
   * be a token in the JavaScript bundle — which is to say, published. The
   * handler at `/api/newsroom/stories` holds the credential server-side, checks
   * the newsroom cookie before using it, and returns the same shape.
   */
  allStories: async (): Promise<StorySummary[]> => {
    const path = "/api/newsroom/stories";

    let response: Response;
    try {
      response = await fetch(path, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
      throw new ApiError(
        timedOut
          ? "The newsroom took too long to answer. Try again."
          : "Could not reach the newsroom.",
        null,
        path,
      );
    }

    if (!response.ok) {
      const detail = await messageFrom(response);
      throw new ApiError(
        // 401 means the newsroom session has lapsed, which is a different
        // instruction from "something broke": one is a door to reopen, the
        // other is a thing to report.
        response.status === 401
          ? "Your newsroom session has expired. Unlock it again to see drafts."
          : (detail ?? `The newsroom returned ${response.status}.`),
        response.status,
        path,
      );
    }

    try {
      return (await response.json()) as StorySummary[];
    } catch {
      throw new ApiError("The newsroom's answer could not be read.", response.status, path);
    }
  },
};
