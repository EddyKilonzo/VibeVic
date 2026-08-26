"use client";

import type { Genre } from "@/data/types";

/**
 * Beats, opened from the workspace.
 *
 * ── What changed ─────────────────────────────────────────────────────────
 * This module used to keep beats in `localStorage` and was honest about the
 * ceiling it hit: "A beat that exists only in this browser still cannot have a
 * public page — it has no row." All it could do was give a draft somewhere to
 * be filed. It writes rows now, so a beat opened here is a beat the site has:
 * it gets a page, it appears in the archive filters, and another device sees
 * it.
 *
 * The consequence is that there is no longer a *kind* of beat. `allBeats()` and
 * `listCustomBeats()` are gone rather than kept as shims, because the
 * distinction they existed to preserve has stopped being true — every beat now
 * comes from `useTaxonomy().genres`, and a helper implying otherwise would send
 * the next reader looking for a second store that is not there.
 *
 * ── Why a beat cannot be renamed ─────────────────────────────────────────
 * Its slug is the primary key and the foreign key every story carries, so a
 * rename is either an orphaned archive or a URL change across every published
 * piece filed under it. The name and description are editable; the slug is
 * decided once, from the name, at the moment the beat is opened.
 */

const BASE = "/api/newsroom/catalog/genres";

/** Long enough for a cold connection, short enough that a hang is visible. */
const TIMEOUT_MS = 15_000;

/**
 * URL-safe slug from a beat name.
 *
 * Not decorative: the slug is the value stored on every story's `genre` field,
 * so it has to be stable and it has to be a legal path segment. The normalise
 * strips accents rather than percent-encoding them, which keeps "Sécurité" a
 * readable `securite` instead of a wall of escapes.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    // A trailing hyphen left by the slice would fail the API's own pattern,
    // which wants single hyphens between words and nothing hanging off an end.
    .replace(/-+$/, "");
}

export interface BeatRow extends Genre {
  createdAt: string;
  /** The version to send back on an edit, so a stale write is refused. */
  updatedAt: string;
}

export type BeatResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "conflict" | "missing" | "blocked" | "failed"; message: string };

async function messageFrom(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Your newsroom session has expired. Unlock it again to continue.";
  }

  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      for (const field of ["error", "message"] as const) {
        if (field in body) {
          const value = (body as Record<string, unknown>)[field];
          if (typeof value === "string" && value) return value;
          if (Array.isArray(value)) {
            const joined = value.filter((v): v is string => typeof v === "string").join("; ");
            if (joined) return joined;
          }
        }
      }
    }
  } catch {
    // A non-JSON error body is ordinary. The status still carries the meaning.
  }
  return `The newsroom returned ${response.status}.`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<BeatResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    return {
      ok: false,
      reason: "failed",
      message: timedOut
        ? "The newsroom took too long to answer. It may be waking up — try again."
        : "Could not reach the newsroom.",
    };
  }

  if (!response.ok) {
    const message = await messageFrom(response);
    /**
     * A 409 here is two different refusals, and the caller says different
     * things about them.
     *
     * On a create it is a slug already taken. On a delete it is a beat with
     * stories filed under it or subjects beneath it — which is not a conflict
     * to retry but a list of things to move first, and the API's message names
     * how many of each. `blocked` keeps them apart at the call site.
     */
    const reason =
      response.status === 409
        ? init.method === "DELETE"
          ? "blocked"
          : "conflict"
        : response.status === 404
          ? "missing"
          : "failed";
    return { ok: false, reason, message };
  }

  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "failed", message: "The newsroom's answer could not be read." };
  }
}

/** Every beat, including the ones with subjects beneath them. */
export function listBeats(): Promise<BeatResult<BeatRow[]>> {
  return request<BeatRow[]>(BASE);
}

export type AddBeatResult = BeatResult<BeatRow> | { ok: false; reason: "invalid"; message: string };

/**
 * Opens a beat.
 *
 * The two client-side refusals are kept — an empty name, and a name with no
 * letters or numbers in it — because both produce a slug the API would reject
 * with a message about a regular expression. The collision that matters is
 * checked on the server, where it can actually be guaranteed: two tabs racing
 * would both pass a local check and one would still have to lose.
 */
export async function addBeat(
  name: string,
  description: string,
  parentSlug?: string,
): Promise<AddBeatResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "invalid", message: "Give the beat a name." };

  const slug = slugify(trimmed);
  if (!slug) {
    return {
      ok: false,
      reason: "invalid",
      message: "That name has no letters or numbers in it.",
    };
  }

  return request<BeatRow>(BASE, {
    method: "POST",
    body: JSON.stringify({
      slug,
      name: trimmed,
      description: description.trim(),
      ...(parentSlug ? { parentSlug } : {}),
    }),
  });
}

/** Edits the name, the description, or which beat this one sits under. */
export function editBeat(
  slug: string,
  patch: { name?: string; description?: string; parentSlug?: string | null },
  expectedUpdatedAt: string,
): Promise<BeatResult<BeatRow>> {
  return request<BeatRow>(`${BASE}/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, expectedUpdatedAt }),
  });
}

/**
 * Removes a beat.
 *
 * Refused by the API while anything is filed under it — see `blocked` above.
 * That refusal is the feature: deleting a beat with stories would either orphan
 * published work or cascade it away, and neither is something a journalist
 * should be able to do by clicking a bin.
 */
export function removeBeat(slug: string): Promise<BeatResult<{ slug: string }>> {
  return request<{ slug: string }>(`${BASE}/${encodeURIComponent(slug)}`, { method: "DELETE" });
}
