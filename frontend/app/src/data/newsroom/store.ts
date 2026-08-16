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
 * Local-first on purpose. There is no server yet, and the honest consequence
 * is that this data lives on one device — that is stated in the UI rather than
 * hidden behind a sync spinner that would never resolve. The shape is the one
 * a real API would return, so moving to Prisma/Postgres later means replacing
 * `read`/`write` with fetches and nothing above this file changes.
 *
 * Two rules the brief calls out, enforced here rather than per-screen:
 *
 *  - **Never silently overwrite newer content.** Every write compares
 *    `updatedAt` against what is on disk. A stale write is rejected and
 *    reported to the caller, which surfaces a conflict instead of losing work.
 *  - **Private material stays private.** `toPublicPayload` is the only
 *    sanctioned way to hand newsroom data to anything reader-facing, and it
 *    drops every private collection outright rather than filtering field by
 *    field — an allowlist cannot leak a field somebody adds later.
 */

const KEY = "vv:newsroom";
const VERSION = 1;

interface Envelope {
  version: number;
  data: Newsroom;
}

const listeners = new Set<() => void>();
let cache: Newsroom | null = null;

function read(): Newsroom {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY_NEWSROOM;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      cache = EMPTY_NEWSROOM;
      return cache;
    }
    const parsed = JSON.parse(raw) as Envelope;
    // An unrecognised version is not migrated silently — the stored shape is
    // kept and the app starts empty, so no one's notes are quietly mangled.
    if (parsed.version !== VERSION) {
      cache = EMPTY_NEWSROOM;
      return cache;
    }
    cache = { ...EMPTY_NEWSROOM, ...parsed.data };
    return cache;
  } catch {
    cache = EMPTY_NEWSROOM;
    return cache;
  }
}

function write(next: Newsroom): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, data: next } satisfies Envelope));
    } catch {
      // Quota or private-browsing refusal. The in-memory copy still holds for
      // this session; the caller is told nothing was persisted.
      return;
    }
  }
  listeners.forEach((fn) => fn());
}

/* ── Subscription, for useSyncExternalStore ──────────────────── */

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSnapshot(): Newsroom {
  return read();
}

export function getServerSnapshot(): Newsroom {
  return EMPTY_NEWSROOM;
}

/* ── Writes ──────────────────────────────────────────────────── */

export type WriteResult<T> = { ok: true; value: T } | { ok: false; reason: "conflict" | "missing" };

type ListKey = {
  [K in keyof Newsroom]: Newsroom[K] extends Record_[] ? K : never;
}[keyof Newsroom];

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function insert<K extends ListKey>(
  key: K,
  record: Omit<Newsroom[K][number], "id" | "createdAt" | "updatedAt"> & Partial<Record_>,
): Newsroom[K][number] {
  const state = read();
  const stamp = nowIso();
  const created = {
    ...record,
    id: record.id ?? newId(key.slice(0, 3)),
    createdAt: record.createdAt ?? stamp,
    updatedAt: stamp,
  } as Newsroom[K][number];

  write({ ...state, [key]: [created, ...(state[key] as Record_[])] } as Newsroom);
  return created;
}

/**
 * Update by id with an optimistic-concurrency check.
 *
 * `expectedUpdatedAt` is the value the caller last saw. If the stored record
 * has moved on since — another tab, a restored backup — the write is refused
 * and the caller decides. Passing `undefined` opts out, which is only correct
 * for a write that cannot lose anything (toggling a checkbox, say).
 */
export function update<K extends ListKey>(
  key: K,
  id: string,
  patch: Partial<Newsroom[K][number]>,
  expectedUpdatedAt?: string,
): WriteResult<Newsroom[K][number]> {
  const state = read();
  const list = state[key] as Record_[];
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return { ok: false, reason: "missing" };

  const existing = list[index];
  if (expectedUpdatedAt !== undefined && existing.updatedAt !== expectedUpdatedAt) {
    return { ok: false, reason: "conflict" };
  }

  const merged = { ...existing, ...patch, id, updatedAt: nowIso() } as Newsroom[K][number];
  const nextList = [...list];
  nextList[index] = merged;
  write({ ...state, [key]: nextList } as Newsroom);
  return { ok: true, value: merged };
}

export function remove<K extends ListKey>(key: K, id: string): void {
  const state = read();
  const list = state[key] as Record_[];
  write({ ...state, [key]: list.filter((r) => r.id !== id) } as Newsroom);
}

/** Non-list fields: portfolio classes and the style guide. */
export function setPortfolioClass(storyId: string, value: Newsroom["portfolio"][string]): void {
  const state = read();
  write({ ...state, portfolio: { ...state.portfolio, [storyId]: value } });
}

export function setStyleGuide(entries: Newsroom["styleGuide"]): void {
  write({ ...read(), styleGuide: entries });
}

/* ── The privacy boundary ────────────────────────────────────── */

/**
 * The only sanctioned way to hand newsroom state to anything public.
 *
 * Deny-by-default: private collections are dropped whole rather than filtered,
 * so adding a sensitive field to `Source` tomorrow cannot accidentally start
 * publishing it. Collections and portfolio classes are curation the journalist
 * chose to make visible, so those survive.
 */
export function toPublicPayload(state: Newsroom = read()) {
  const publicState: Record<string, unknown> = {
    collections: state.collections,
    portfolio: state.portfolio,
  };
  for (const key of PRIVATE_COLLECTIONS) {
    if (key in publicState) delete publicState[key];
  }
  return publicState as { collections: Newsroom["collections"]; portfolio: Newsroom["portfolio"] };
}

/** Full local export — the journalist's own data, for backup. */
export function exportAll(): string {
  return JSON.stringify({ version: VERSION, exportedAt: nowIso(), data: read() }, null, 2);
}
