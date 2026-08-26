"use client";

import type { Award } from "@/data/types";

/**
 * Awards, recorded in the newsroom.
 *
 * ── Why this store exists at all ─────────────────────────────────────────
 * `data/content` shipped `AWARDS` as an empty array, and the comment above it
 * was explicit about why: inventing a prize for a real journalist would be a
 * fabricated credential. The public page therefore rendered an honest empty
 * state "until real entries are added in the admin" — and there was no admin to
 * add them in. This is the writer.
 *
 * ── What changed ─────────────────────────────────────────────────────────
 * It used to write to `localStorage`, and said so: "a record here is still only
 * a note the journalist made, not a claim the site is making, until it is
 * written through to the API." It is written through now, so the note and the
 * claim are one record — which also means the awards page finally has something
 * to read, since it has always read the API.
 *
 * The signatures return promises as a result. A synchronous wrapper that fired
 * a request and returned as though it had worked would be lying about whether a
 * credential was recorded, which is the one thing this module exists to be
 * truthful about.
 *
 * ── The rule the store still enforces ────────────────────────────────────
 * Nothing here is generated, suggested or autocompleted. There is no list of
 * plausible bodies to pick from and no default result, because a form that
 * offers "Winner" as the pre-selected answer is a form that will eventually
 * record one that was never won. The API refuses a blank and checks `result`
 * against the four below — the second of two gates, and the one that still
 * holds when somebody posts directly.
 */

const BASE = "/api/newsroom/catalog/awards";

/** Long enough for a cold connection, short enough that a hang is visible. */
const TIMEOUT_MS = 15_000;

export interface RecordedAward extends Award {
  id: string;
  createdAt: string;
  /** The version to send back on an edit, so a stale write is refused. */
  updatedAt: string;
}

export const RESULTS: Award["result"][] = [
  "Winner",
  "Finalist",
  "Shortlisted",
  "Honourable mention",
];

export type AwardResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "conflict" | "missing" | "failed"; message: string };

/** The handler's own sentence where there is one; it is written for a person. */
async function messageFrom(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Your newsroom session has expired. Unlock it again to continue.";
  }
  if (response.status === 409) {
    return "This award changed after you loaded it. Your edit was not applied.";
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

async function request<T>(path: string, init: RequestInit = {}): Promise<AwardResult<T>> {
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
    const reason =
      response.status === 409 ? "conflict" : response.status === 404 ? "missing" : "failed";
    return { ok: false, reason, message };
  }

  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "failed", message: "The newsroom's answer could not be read." };
  }
}

/**
 * Every award, newest year first.
 *
 * Ordered on the server, which is where the ordering belongs now that more than
 * one device can see the list. An awards list is read as a career in reverse,
 * which is how the public timeline renders it too.
 */
export function listAwards(): Promise<AwardResult<RecordedAward[]>> {
  return request<RecordedAward[]>(BASE);
}

export function addAward(award: Award): Promise<AwardResult<RecordedAward>> {
  return request<RecordedAward>(BASE, {
    method: "POST",
    body: JSON.stringify({
      year: award.year,
      title: award.title,
      body: award.body,
      description: award.description,
      result: award.result,
    }),
  });
}

/**
 * Edits one award.
 *
 * `expectedUpdatedAt` is required rather than optional, and the caller has to
 * pass the copy it rendered. The API compares it inside a conditional UPDATE
 * and answers 409 when it has moved on — so an award edited in another tab is
 * reported rather than silently overwritten.
 */
export function editAward(
  id: string,
  patch: Partial<Award>,
  expectedUpdatedAt: string,
): Promise<AwardResult<RecordedAward>> {
  return request<RecordedAward>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, expectedUpdatedAt }),
  });
}

/**
 * Removes one award.
 *
 * A hard delete, and safely so: nothing references an award — no story carries
 * an award id, no view joins one — so the row is the whole fact and removing it
 * leaves nothing dangling. That is why this is a real delete where a story is
 * not.
 */
export function removeAward(id: string): Promise<AwardResult<{ id: string }>> {
  return request<{ id: string }>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
