"use client";

import type { Story } from "@/data/types";

/**
 * Sending a draft to Postgres.
 *
 * ── What changed, and why the signature says so ──────────────────────────
 * `lib/drafts.ts` used to be the whole story: the workspace wrote to
 * `localStorage` and the indicator said "Saved on this device", which was the
 * honest label for a browser-only store. The API has a story table and a
 * credential-holding proxy in front of it now, so the draft can leave the
 * machine — and the moment it can, the difference between "the server has this"
 * and "this browser has this" becomes something the writer needs told, not
 * something to smooth over with one word.
 *
 * So every call here resolves to a discriminated result rather than throwing,
 * and the workspace renders which one it got. Nothing in this module decides
 * what to say; it decides what is true.
 *
 * ── The local copy is not replaced by this ───────────────────────────────
 * It is kept, and demoted. `writeDraft` still runs first on every save because
 * it is synchronous and cannot fail for a network reason — so when the request
 * does fail, the writing is on the device and the writer is told exactly that
 * instead of losing an afternoon to a dropped connection.
 */

/** Long enough for a cold Neon connection, short enough that a hang is visible. */
const TIMEOUT_MS = 15_000;

export type SaveOutcome =
  /** The server holds this version. `story` carries the id and the new `updatedAt`. */
  | { ok: true; story: Story; created: boolean }
  /**
   * The row moved on since this editor loaded it — another tab, another
   * machine. Nothing was written. Deliberately its own case: a conflict is not
   * an outage, and telling a writer to "try again" would either do nothing or
   * quietly clobber the other edit.
   */
  | { ok: false; reason: "conflict"; message: string }
  /** The session cookie has lapsed. The fix is a sign-in, not a retry. */
  | { ok: false; reason: "locked"; message: string }
  /** The API refused the content — a field too long, a beat that does not exist. */
  | { ok: false; reason: "refused"; message: string }
  /** The network, or the API being down. Retrying is reasonable. */
  | { ok: false; reason: "unreachable"; message: string };

/** The handler's own sentence where there is one; it is written for a person. */
async function messageFrom(response: Response, fallback: string): Promise<string> {
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
    // A non-JSON error body is ordinary — a proxy or a gateway timeout. The
    // status still carries the meaning.
  }
  return fallback;
}

function failure(status: number, message: string): SaveOutcome {
  if (status === 409) return { ok: false, reason: "conflict", message };
  if (status === 401) return { ok: false, reason: "locked", message };
  // 400 and 404 are about what was sent or asked for; 5xx and 502 are about the
  // server being unable to answer at all, and only the second is worth retrying
  // unchanged.
  if (status >= 400 && status < 500) return { ok: false, reason: "refused", message };
  return { ok: false, reason: "unreachable", message };
}

async function send(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  created: boolean,
): Promise<SaveOutcome> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    return {
      ok: false,
      reason: "unreachable",
      message: timedOut
        ? "The newsroom took too long to answer. It may be waking up."
        : "Could not reach the newsroom.",
    };
  }

  if (!response.ok) {
    const message = await messageFrom(
      response,
      response.status === 401
        ? "Your newsroom session has expired. Unlock it again to keep saving."
        : `The newsroom returned ${response.status}.`,
    );
    return failure(response.status, message);
  }

  try {
    return { ok: true, story: (await response.json()) as Story, created };
  } catch {
    /**
     * The write landed but the answer did not parse.
     *
     * Reported as a conflict rather than a failure, and the distinction is not
     * pedantry: the row may well have been written, so this editor's idea of
     * `updatedAt` is now unreliable. Treating it as "retry" would send the same
     * stale timestamp again; treating it as "reload before continuing" is the
     * only instruction that is true either way.
     */
    return {
      ok: false,
      reason: "conflict",
      message: "The newsroom's answer could not be read. Reload the piece before editing further.",
    };
  }
}

/** Files a story that has no row yet. The slug is derived server-side, once. */
export function createStory(story: Story): Promise<SaveOutcome> {
  return send("/api/newsroom/stories", "POST", story, true);
}

/** Saves a story that already exists, with the concurrency check the API insists on. */
export function updateStory(
  id: string,
  story: Story,
  expectedUpdatedAt: string,
): Promise<SaveOutcome> {
  return send(
    `/api/newsroom/stories/${encodeURIComponent(id)}`,
    "PATCH",
    { story, expectedUpdatedAt },
    false,
  );
}
