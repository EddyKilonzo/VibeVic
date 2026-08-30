import "server-only";

import { sessionToken } from "@/lib/newsroom-auth";
import { toStory, type AdminStoryRow } from "@/lib/story-records";
import type { Story } from "./types";

/**
 * Server-side reads of the newsroom surface.
 *
 * Split from `data/server.ts` because these carry a credential and those do
 * not. Everything in this file sends the reader's own session token, so
 * everything in it can see drafts — and keeping that in a separate module
 * makes it obvious in an import line when a page has reached for the
 * privileged reader.
 *
 * ── The credential used to belong to the server ──────────────────────────
 * It was `NEWSROOM_API_TOKEN`, one shared key with the widest role on the
 * system, sent for whoever happened to be looking at the page. It is the
 * caller's own token now, which means a page rendered for a DEV account is
 * subject to what a DEV may read — the API filters confidential records out
 * of the query rather than out of the markup, so the difference is real
 * rather than cosmetic.
 *
 * Callers must already be behind the newsroom gate. Every route that uses
 * this lives under the workspace mount, which the middleware covers; this
 * file does not re-check, because a data module that decides authorisation is
 * a data module somebody will call from the wrong place and believe they are
 * safe.
 */

const BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

/**
 * A read that says whether the server answered, not just what it said.
 *
 * ── Why "null" was not enough ────────────────────────────────────────────
 * This used to collapse "no such story" and "the API is down" into the same
 * `null`, and the workspace read both as "start a blank draft here". That was
 * survivable while the editor only wrote to `localStorage`. It stopped being
 * survivable the moment the editor could create rows: open an existing piece
 * during a thirty-second outage and the first autosave would file a *second*
 * record for the same article, with a fresh slug and none of the history.
 *
 * So the two are separated, and `reachable` is the field the workspace acts
 * on: an editor that does not know whether a record exists must not create one.
 */
interface AdminRead<T> {
  value: T | null;
  /** False when the request failed or there is no session — not for a 404. */
  reachable: boolean;
}

async function readAdmin<T>(path: string): Promise<AdminRead<T>> {
  const token = await sessionToken();
  if (!token) {
    /*
     * No session, so `reachable: false` — and that is the correct reading
     * rather than a convenient one. The caller's contract is "do not create a
     * record when you cannot tell whether one exists", and an unauthenticated
     * read tells you exactly as little as a failed one does.
     *
     * In practice the middleware has already redirected anybody in this state
     * to the sign-in page; this is the second lock reporting honestly.
     */
    console.error(`[data/server-admin] no newsroom session; ${path} not attempted.`);
    return { value: null, reachable: false };
  }

  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      // Never cached. A draft is edited and re-read seconds later, and serving
      // a journalist a stale copy of their own work is how an edit gets lost.
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    // A 404 is an answer: the server is up and this story does not exist.
    if (response.status === 404) return { value: null, reachable: true };

    if (!response.ok) {
      console.error(`[data/server-admin] GET ${path} -> ${response.status}`);
      return { value: null, reachable: false };
    }

    return { value: (await response.json()) as T, reachable: true };
  } catch (cause) {
    console.error(`[data/server-admin] GET ${path} failed:`, cause);
    return { value: null, reachable: false };
  }
}

/**
 * One story for the editor — drafts included, body and all.
 *
 * `story` is null both for a piece that does not exist and for one this process
 * could not ask about; `reachable` is what tells them apart, and the workspace
 * needs the difference — see `AdminRead` above.
 */
export async function getAdminStory(
  id: string,
): Promise<{ story: Story | null; reachable: boolean }> {
  const { value, reachable } = await readAdmin<AdminStoryRow>(
    `/admin/stories/${encodeURIComponent(id)}`,
  );
  return { story: value ? toStory(value) : null, reachable };
}
