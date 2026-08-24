"use client";

import { api } from "@/data/api";
import type { StorySummary } from "@/data/types";
import { useAsync, type AsyncState } from "./useAsync";

/**
 * Story lists for client views.
 *
 * Six admin screens and several public ones need the archive, and each was
 * reading the bundled `STORIES` array directly. They now read the API, and
 * doing that inline in every view would mean six copies of the same
 * `useAsync(() => …, [])` — six places to forget an error state, and six
 * places to change when the call changes.
 *
 * The distinction between the two is not cosmetic. `usePublishedStories`
 * reads the public endpoint and returns only what a reader could see;
 * `useAllStories` goes through the newsroom proxy and includes drafts and
 * scheduled pieces. A public screen that accidentally used the second would
 * put unpublished work on a reader's page, so they are named to make the
 * wrong one look wrong.
 */

/** Published work only, from the public API. Safe for reader-facing screens. */
export function usePublishedStories(): AsyncState<StorySummary[]> {
  return useAsync(() => api.stories(), []);
}

/**
 * Everything, drafts included, via the cookie-gated newsroom proxy.
 *
 * Admin screens only. Fails with a 401 rather than leaking anything if the
 * newsroom session has lapsed.
 */
export function useAllStories(): AsyncState<StorySummary[]> {
  return useAsync(() => api.allStories(), []);
}
