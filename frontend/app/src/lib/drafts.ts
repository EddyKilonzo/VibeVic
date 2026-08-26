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
 * ── What this is now, since the API landed ───────────────────────────────
 * Not the store. `lib/story-save.ts` sends the draft to Postgres, and that is
 * where a piece lives. This is the layer underneath it: `writeDraft` runs first
 * on every autosave, before the request, because it is synchronous and cannot
 * fail for a network reason.
 *
 * That ordering is the whole value of keeping it. When the request fails — a
 * dropped connection, a lapsed session, a conflict with another tab — the words
 * are already on the device, so the editor can say "saved here, not sent yet"
 * instead of asking somebody to copy their work out of a textarea. It stopped
 * being the only copy and became the one that cannot go missing.
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

/**
 * Every draft held on this device, newest first.
 *
 * Reads the keyspace rather than a manifest. A manifest is one more thing to
 * keep in step with reality, and when it drifts the drafts it forgot about
 * become invisible rather than merely unlisted — which, for the only copy of
 * somebody's writing, is the worst failure this module could have.
 */
export function listDrafts(): StoredDraft[] {
  if (typeof window === "undefined") return [];
  const out: StoredDraft[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const record = readDraft(k.slice(PREFIX.length));
      if (record) out.push(record);
    }
  } catch {
    return out;
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Words in a draft's body — the figure a writer actually tracks. */
export function draftWordCount(story: Story): number {
  return story.body
    .map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : ""))
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function discardDraft(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    /* Nothing useful to do — the draft simply stays. */
  }
}
