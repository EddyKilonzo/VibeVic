"use client";

import {
  EMPTY_NEWSROOM,
  PRIVATE_COLLECTIONS,
  type Newsroom,
  type Record_,
} from "./types";

/**
 * The newsroom repository.
 *
 * This file used to be local-first, and said so: "There is no server yet, and
 * the honest consequence is that this data lives on one device." It promised
 * that moving to Postgres would mean replacing `read`/`write` with fetches and
 * changing nothing above this file. This is that change, and the promise held
 * for the read path — `useSyncExternalStore`, the snapshot, the subscription
 * are all still here, because a network cache is an external store in exactly
 * the way localStorage was.
 *
 * The write path could not keep it, and the reason is worth stating rather than
 * hiding behind an identical signature: a write is now a round trip that can
 * fail, so `insert`, `update` and `remove` return promises. A synchronous
 * wrapper that fired a request and returned as if it had worked would be
 * lying — and lying specifically about whether a journalist's note was saved,
 * which is the one thing this store exists to be truthful about.
 *
 * ── What is no longer true, and is worth deleting from your memory ───────
 * The data is not on one device. Clearing site data does not destroy it.
 * Two tabs, or a laptop and a phone, see the same newsroom. Records are not
 * held in localStorage at all, so nothing here reads or writes it.
 *
 * ── What is still true ───────────────────────────────────────────────────
 * Both original rules survive, and both are now enforced twice:
 *
 *  - **Never silently overwrite newer content.** Every update carries the
 *    `updatedAt` the caller last saw. The API compares it inside a conditional
 *    UPDATE and answers 409 if it has moved on; this file surfaces that as a
 *    conflict rather than retrying.
 *  - **Private material stays private.** `toPublicPayload` still drops private
 *    collections whole. It is now the second of two such gates — the API's
 *    public views are the first, and neither is allowed to rely on the other.
 */

/**
 * Same-origin, and never the API directly.
 *
 * The API wants a bearer token. A token this file could read is a token in the
 * JavaScript bundle, which is to say a published token. These handlers hold the
 * credential server-side, check the newsroom cookie before using it, and
 * translate between the API's Prisma enums and this app's vocabulary.
 */
const BASE = "/api/newsroom/records";

/** Long enough for a cold Neon connection, short enough that a hang is visible. */
const TIMEOUT_MS = 15_000;

/* ── The cache ───────────────────────────────────────────────── */

type ListKey = {
  [K in keyof Newsroom]: Newsroom[K] extends Record_[] ? K : never;
}[keyof Newsroom];

export type { ListKey };

export type LoadStatus = "idle" | "loading" | "ready" | "error";

const listeners = new Set<() => void>();

/**
 * Replaced rather than mutated on every change.
 *
 * `useSyncExternalStore` compares snapshots by identity, so mutating this in
 * place would leave every screen showing stale data with no way to tell. The
 * cost is one shallow object copy per write, which against a network round trip
 * does not register.
 */
let cache: Newsroom = EMPTY_NEWSROOM;

const status = new Map<ListKey, LoadStatus>();
const failures = new Map<ListKey, string>();

/**
 * In-flight loads, so two components mounting at once make one request.
 *
 * Without this the Ideas screen and anything else asking for `ideas` in the
 * same tick would each start a fetch, and the slower answer would overwrite the
 * faster one — usually harmlessly, occasionally with a stale list.
 */
const inFlight = new Map<ListKey, Promise<void>>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function put(key: ListKey, rows: Record_[]): void {
  cache = { ...cache, [key]: rows } as Newsroom;
  emit();
}

/* ── Subscription, for useSyncExternalStore ──────────────────── */

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSnapshot(): Newsroom {
  return cache;
}

/**
 * The server render has no session and must not have one.
 *
 * These routes are prerendered and the newsroom cookie is not available to
 * them, so the honest server snapshot is empty. Screens render their loading
 * state against it and fill in on the client, which is the same shape the
 * public data layer already uses.
 */
export function getServerSnapshot(): Newsroom {
  return EMPTY_NEWSROOM;
}

export function statusOf(key: ListKey): LoadStatus {
  return status.get(key) ?? "idle";
}

export function errorOf(key: ListKey): string | null {
  return failures.get(key) ?? null;
}

/* ── Reads ───────────────────────────────────────────────────── */

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new NewsroomError(
      timedOut
        ? "The newsroom took too long to answer. It may be waking up — try again."
        : "Could not reach the newsroom.",
      null,
    );
  }

  if (!response.ok) {
    throw new NewsroomError(await messageFrom(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new NewsroomError("The newsroom's answer could not be read.", response.status);
  }
}

export class NewsroomError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "NewsroomError";
  }
}

/**
 * The handler's own message where there is one.
 *
 * Worth forwarding for a 4xx: those are written for a person and say which
 * field was wrong. A 401 is rewritten, because "Unauthorized" is not an
 * instruction and "unlock the newsroom again" is.
 */
async function messageFrom(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Your newsroom session has expired. Unlock it again to continue.";
  }
  if (response.status === 409) {
    return "This record changed after you loaded it. Your edit was not applied.";
  }

  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      for (const field of ["error", "message"] as const) {
        if (field in body) {
          const value = (body as Record<string, unknown>)[field];
          if (typeof value === "string") return value;
          if (Array.isArray(value)) {
            return value.filter((v): v is string => typeof v === "string").join("; ");
          }
        }
      }
    }
  } catch {
    // A non-JSON error body is ordinary. The status still carries the meaning.
  }
  return `The newsroom returned ${response.status}.`;
}

/**
 * Loads a collection once.
 *
 * Idempotent by design: a screen may call it on every render and only the first
 * call does anything. `reload` is the way to ask for fresh data on purpose.
 */
export function ensureLoaded(key: ListKey): Promise<void> {
  const current = statusOf(key);
  if (current === "ready" || current === "error") return Promise.resolve();

  const existing = inFlight.get(key);
  if (existing) return existing;

  return reload(key);
}

export function reload(key: ListKey): Promise<void> {
  const run = (async () => {
    status.set(key, "loading");
    failures.delete(key);
    emit();

    try {
      const rows = await request<Record_[]>(`${BASE}/${key}`);
      status.set(key, "ready");
      put(key, rows);
    } catch (cause) {
      status.set(key, "error");
      failures.set(
        key,
        cause instanceof NewsroomError ? cause.message : "Something went wrong.",
      );

      /**
       * A lapsed session empties the cache, not just this collection.
       *
       * The records already fetched are still sitting in memory, and a 401
       * means the door they came through has closed. Leaving them on screen
       * would show sources and unpublished ideas to whoever is at the machine
       * now — the exact failure the twelve-hour cookie and the sign-out button
       * exist to prevent, reintroduced one layer up.
       *
       * The load statuses are deliberately left at "error" rather than reset.
       * Clearing them would let `ensureLoaded` immediately try again, and a
       * screen mounted against a dead session would spin through a refetch
       * loop instead of saying the session has expired.
       */
      if (cause instanceof NewsroomError && cause.status === 401) {
        cache = EMPTY_NEWSROOM;
      }

      emit();
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, run);
  return run;
}

/* ── Writes ──────────────────────────────────────────────────── */

/**
 * A refused write, named so the failure branch can be returned on its own.
 *
 * `reason` is three values rather than a boolean because the screens do
 * genuinely different things with them: a conflict means reload and let the
 * journalist re-apply, missing means the row is gone, and failed means the
 * network or the API. Collapsing them would reduce every one of those to the
 * same unhelpful sentence.
 */
export interface WriteFailure {
  ok: false;
  reason: "conflict" | "missing" | "failed";
  message: string;
}

export type WriteResult<T> = { ok: true; value: T } | WriteFailure;

function failureFrom(cause: unknown): WriteFailure {
  if (cause instanceof NewsroomError) {
    if (cause.status === 409) return { ok: false, reason: "conflict", message: cause.message };
    if (cause.status === 404) return { ok: false, reason: "missing", message: cause.message };
    return { ok: false, reason: "failed", message: cause.message };
  }
  return { ok: false, reason: "failed", message: "Something went wrong." };
}

/**
 * Fields the server owns.
 *
 * Stripped before every create, because the API validates with
 * `forbidNonWhitelisted` and would answer 400 rather than ignore them. That is
 * the right behaviour on its side and it has one visible consequence here:
 * re-creating a deleted record — an undo — produces a new record with a new id
 * and a new creation date, not a resurrection of the old one. Callers that care
 * about the difference are told so at the call site.
 */
const SERVER_OWNED = ["id", "createdAt", "updatedAt"] as const;

function withoutServerFields(record: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if ((SERVER_OWNED as readonly string[]).includes(key)) continue;
    out[key] = value;
  }
  return out;
}

export async function insert<K extends ListKey>(
  key: K,
  record: Omit<Newsroom[K][number], "id" | "createdAt" | "updatedAt"> & Partial<Record_>,
): Promise<WriteResult<Newsroom[K][number]>> {
  try {
    const created = await request<Newsroom[K][number]>(`${BASE}/${key}`, {
      method: "POST",
      body: JSON.stringify(withoutServerFields(record)),
    });

    // Prepended, matching the API's own newest-first ordering. Screens that
    // want another order sort the list themselves, as they always did.
    put(key, [created, ...(cache[key] as Record_[])]);
    return { ok: true, value: created };
  } catch (cause) {
    return failureFrom(cause);
  }
}

/**
 * Update by id, with the concurrency check the API insists on.
 *
 * `expectedUpdatedAt` may be omitted, and the meaning has shifted slightly from
 * the local store. There it meant "opt out of the check"; the API has no opt
 * out, so here it means "use the timestamp from the copy in the cache". For the
 * writes that used to opt out — swapping one enum for another — that is the
 * same thing in practice and strictly safer: a value another tab changed a
 * moment ago now produces a conflict instead of being silently clobbered.
 */
export async function update<K extends ListKey>(
  key: K,
  id: string,
  patch: Partial<Newsroom[K][number]>,
  expectedUpdatedAt?: string,
): Promise<WriteResult<Newsroom[K][number]>> {
  const list = cache[key] as Record_[];
  const known = list.find((row) => row.id === id);
  const expected = expectedUpdatedAt ?? known?.updatedAt;

  if (!expected) {
    // Nothing loaded and nothing supplied. Refusing beats sending a guess: a
    // fabricated timestamp would either be rejected as a conflict or, far
    // worse, happen to match and overwrite an edit nobody has seen.
    return {
      ok: false,
      reason: "missing",
      message: "That record is not loaded, so it cannot be edited yet.",
    };
  }

  try {
    const updated = await request<Newsroom[K][number]>(
      `${BASE}/${key}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...withoutServerFields(patch), expectedUpdatedAt: expected }),
      },
    );

    put(
      key,
      list.map((row) => (row.id === id ? (updated as Record_) : row)),
    );
    return { ok: true, value: updated };
  } catch (cause) {
    // A conflict means the cached copy is stale by definition, so the list is
    // refreshed. The caller still gets the conflict and decides what to say.
    const result = failureFrom(cause);
    if (result.reason === "conflict") void reload(key);
    return result;
  }
}

export async function remove<K extends ListKey>(
  key: K,
  id: string,
): Promise<WriteResult<{ id: string }>> {
  try {
    await request<{ id: string; deleted: boolean }>(
      `${BASE}/${key}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );

    put(key, (cache[key] as Record_[]).filter((row) => row.id !== id));
    return { ok: true, value: { id } };
  } catch (cause) {
    return failureFrom(cause);
  }
}

/* ── Counts ──────────────────────────────────────────────────── */

export type NewsroomCounts = Partial<Record<ListKey, number>>;

/**
 * How much the newsroom holds, without fetching any of it.
 *
 * Counted in the database. The settings screen wants one number and would
 * otherwise have to download eleven collections — every source, every interview
 * note — to add up their lengths and throw the material away. The counts also
 * respect the confidential tier, so a total never announces the existence of
 * rows the reader is not allowed to know about.
 */
export async function fetchCounts(): Promise<NewsroomCounts> {
  return request<NewsroomCounts>("/api/newsroom/summary");
}

/* ── The privacy boundary ────────────────────────────────────── */

/**
 * The only sanctioned way to hand newsroom state to anything public.
 *
 * Deny-by-default: private collections are dropped whole rather than filtered,
 * so adding a sensitive field to `Source` tomorrow cannot accidentally start
 * publishing it. Collections and portfolio classes are curation the journalist
 * chose to make visible, so those survive.
 *
 * Still here, and still not the only such gate. The API projects every public
 * response through a declared view and runs a leak tripwire over the result.
 * Two independent implementations of one rule is the point — either can be
 * wrong without the material reaching a reader.
 */
export function toPublicPayload(state: Newsroom = cache) {
  const publicState: Record<string, unknown> = {
    collections: state.collections,
    portfolio: state.portfolio,
  };
  for (const key of PRIVATE_COLLECTIONS) {
    if (key in publicState) delete publicState[key];
  }
  return publicState as { collections: Newsroom["collections"]; portfolio: Newsroom["portfolio"] };
}

/**
 * Everything currently loaded, for backup.
 *
 * Takes the snapshot rather than reaching for the module cache, so a caller
 * cannot accidentally export an empty file by forgetting to load anything
 * first — the state it passes is the state its own screen is rendering, and if
 * that is empty the person can see it is. An export that quietly fetched all
 * eleven collections would be a much heavier operation than the one the button
 * appears to offer, so it does not do that either.
 */
export function exportAll(state: Newsroom = cache): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), data: state },
    null,
    2,
  );
}

/** Clears the cache. Used when the newsroom is locked, so the next unlock refetches. */
export function forget(): void {
  cache = EMPTY_NEWSROOM;
  status.clear();
  failures.clear();
  inFlight.clear();
  emit();
}
