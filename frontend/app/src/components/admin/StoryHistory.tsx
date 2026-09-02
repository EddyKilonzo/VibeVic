"use client";

import { useCallback, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import type { Block, Story } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { formatRelative } from "@/lib/format";
import { notify } from "@/lib/toast";

/**
 * What this piece said before, and a way back to it.
 *
 * ── The gap this closes ──────────────────────────────────────────────────
 * The editor autosaves, which means every deletion is saved as diligently as
 * every addition. A paragraph cut at eleven and regretted at three had
 * nowhere to be recovered from: the local draft in `lib/drafts` holds one
 * copy, the newest, and the server held one row, also the newest. Undo lived
 * for as long as the tab did.
 *
 * ── Restoring is an ordinary edit ────────────────────────────────────────
 * Pressing restore puts the headline, standfirst and body back into the
 * editor and leaves them there unsaved. It does not write anything by itself,
 * and that is the design rather than a missing step: a restore that saved
 * immediately would be a destructive action behind a single click, taken
 * against a version the writer has only seen the date of. Loading it into the
 * editor means they read it first, and the autosave they already trust does
 * the rest — through the same optimistic lock, and snapshotting the copy it
 * replaces, so the restore is itself undoable.
 *
 * ── Why the list is only fetched when opened ─────────────────────────────
 * Bodies are included, because a list of dates you cannot read is a list
 * nobody can choose from. That makes it the largest payload on this screen
 * and the least often wanted, so it is behind a disclosure and refetched each
 * time it is opened — a history that was stale would be showing a version
 * that is no longer the one before this one.
 *
 * The fetch hangs off the button rather than off an effect watching `open`,
 * which is what it actually is: opening the panel is an event, not a piece of
 * state to be synchronised with. An effect here would also be a setState in
 * an effect body, and the rule against those exists for the reason it would
 * apply here — a cascading render for something a handler can just do.
 */

interface Revision {
  id: string;
  title: string;
  dek: string;
  body: Block[];
  createdAt: string;
}

export function StoryHistory({
  storyId,
  onRestore,
}: {
  storyId: string | null;
  /** Hands the older copy back to the editor. Nothing is written here. */
  onRestore: (copy: Pick<Story, "title" | "dek" | "body">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storyId) return;
    setError(null);
    try {
      const response = await fetch(
        `/api/newsroom/stories/${encodeURIComponent(storyId)}/revisions`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `The newsroom returned ${response.status}.`);
        return;
      }
      setRevisions((await response.json()) as Revision[]);
    } catch {
      setError("Could not reach the newsroom.");
    }
  }, [storyId]);

  // Nothing to have a history of yet. Said by absence rather than by an empty
  // panel: a piece that has never been saved has not lost anything.
  if (!storyId) return null;

  return (
    <section className="surface mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 p-5 text-left transition-colors duration-normal hover:bg-secondary/50"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <History className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Earlier versions</span>
          <span className="block text-[12px] text-muted-foreground">
            {open
              ? "The copy as it stood before each edit."
              : "What this piece said before, and a way back to it."}
          </span>
        </span>
        <span className="text-[12px] font-semibold text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-5">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!error && revisions === null && (
            <p className="text-sm text-muted-foreground">Reading the history.</p>
          )}

          {!error && revisions?.length === 0 && (
            <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              Nothing yet. A version is kept when an edit replaces one — at most one every
              ten minutes while you are drafting, and one for every change to a piece that is
              already live, because editing something readers can see is a correction.
            </p>
          )}

          <ul className="space-y-2">
            {revisions?.map((revision) => (
              <li
                key={revision.id}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-background p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {revision.title || "Untitled"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Until {formatRelative(revision.createdAt)} · {revision.body.length} block
                    {revision.body.length === 1 ? "" : "s"}
                  </p>
                  {revision.dek && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                      {revision.dek}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onRestore({
                      title: revision.title,
                      dek: revision.dek,
                      body: revision.body,
                    });
                    notify.success(
                      "Loaded into the editor",
                      "Nothing is saved yet — read it, then let it save as usual.",
                    );
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
