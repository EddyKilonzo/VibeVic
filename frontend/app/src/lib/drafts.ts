"use client";

import type { Story } from "@/data/types";

/**
 * Where a draft actually lives.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The workspace's `save` was a 450ms `setTimeout` that threw its argument
 * away. Everything downstream of it was therefore a claim about something
 * that had not happened: the indicator said "Saved 2 minutes ago", the
 * publish action said "Story published", and closing the tab lost the lot.
 * A writer following that interface all the way through loses their work at
 * the end of it, which is the opposite of a workspace.
 *
 * There is no API yet. What there *is* is this browser, so that is what the
 * draft is written to and exactly what the interface now says: saved on this
 * device. When the API lands this module is the one place that changes.
 *
 * ── What it deliberately does not do ─────────────────────────────────────
 * It never silently replaces the seed copy of a story. A local draft and the
 * published version can disagree, and resolving that quietly in favour of
 * whichever one a helper happened to read first is how edits disappear. The
 * workspace asks.
 */

const PREFIX = "vv:draft:";

export interface StoredDraft {
  story: Story;
  /** When this copy was written, ISO. */
  savedAt: string;
}

function key(id: string): string {
  return `${PREFIX}${id}`;
}

/** Reads a stored draft. Returns null for anything unreadable rather than throwing. */
export function readDraft(id: string): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    // A stored shape from an older build is not worth crashing an editor over.
    if (!parsed?.story?.id || typeof parsed.savedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Writes a draft.
 *
 * Throws on failure rather than swallowing it — a full quota or a browser in
 * private mode means the writing is not safe, and `useAutosave` turns a
 * rejected promise into the visible "Couldn't save" state. Failing silently
 * here would put the reassuring label back over nothing, which is the bug
 * this module was written to remove.
 */
export function writeDraft(story: Story): StoredDraft {
  const record: StoredDraft = { story, savedAt: new Date().toISOString() };
  window.localStorage.setItem(key(story.id), JSON.stringify(record));
  return record;
}

export function discardDraft(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    /* Nothing useful to do — the draft simply stays. */
  }
}
