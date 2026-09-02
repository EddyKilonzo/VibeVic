"use client";

import { useState } from "react";
import { CalendarClock, Globe, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Story } from "@/data/types";
import { notify } from "@/lib/toast";

/**
 * The publish control, and the whole of the writer's relationship with the
 * public site.
 *
 * ── One control, three shapes ────────────────────────────────────────────
 * This screen used to carry two buttons that looked like a pair and were not.
 * "Mark ready" wrote a word onto the local draft; "Publish" asked a server
 * that answered 501. Both were about publication, neither published, and the
 * comment beside them had to explain that at length — which is the tell that
 * the interface was making the reader do the work.
 *
 * Now the server can actually do it, there is one control, and it shows the
 * piece the state it is in plus the moves available from there:
 *
 *   a draft      → Publish, or Schedule
 *   scheduled    → the date it goes live, Publish now, or Cancel
 *   published    → Take down
 *
 * A writer never has to know which of those is a status column and which is a
 * request, because from here they are all the same act.
 *
 * ── Why the schedule input is not always visible ─────────────────────────
 * Most pieces are published when they are finished. A date field standing open
 * next to the publish button asks every writer to make a decision about timing
 * that almost none of them have, and an empty date field beside a button is
 * ambiguous in the worst direction — it reads as though publishing needs one.
 * So scheduling is a second click, and the first click still does the ordinary
 * thing.
 *
 * ── Errors are the API's own sentence ────────────────────────────────────
 * The canonical check refuses with a reason and the fix in it — "still marked
 * as placeholder", "nothing in the body yet". Those are forwarded verbatim.
 * Replacing them with "something went wrong" would throw away the only part of
 * the response the writer can act on.
 */

type Action = "publish" | "schedule" | "unpublish";

export function PublishControls({
  storyId,
  status,
  publishedAt,
  onChanged,
}: {
  /** Null until the piece has been filed and has a record to point at. */
  storyId: string | null;
  status: Story["status"];
  publishedAt: string;
  onChanged: (story: Story) => void;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [picking, setPicking] = useState(false);
  const [when, setWhen] = useState(defaultSchedule);

  const run = async (action: Action, publishAt?: string) => {
    if (!storyId) {
      notify.error(
        "This piece has no record yet",
        "Give it a headline and let it save once; publishing needs something to point at.",
      );
      return;
    }

    setBusy(action);
    try {
      const response = await fetch(
        `/api/newsroom/stories/${encodeURIComponent(storyId)}/publish`,
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(publishAt ? { action, publishAt } : { action }),
          cache: "no-store",
        },
      );

      if (response.ok) {
        const live = (await response.json()) as Story;
        onChanged(live);
        setPicking(false);
        notify.success(...told(action, live));
        return;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      notify.error(
        action === "unpublish" ? "The piece is still on the site" : "The piece was not published",
        body?.error ?? `The newsroom returned ${response.status}.`,
      );
    } catch {
      notify.error(
        "Nothing changed",
        "Could not reach the newsroom. The piece is where it was.",
      );
    } finally {
      setBusy(null);
    }
  };

  /* ── Scheduled: say when, and offer both ways out ────────────────────── */
  if (status === "scheduled" && !picking) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Goes live {formatWhen(publishedAt)}
        </span>
        <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
          Change
        </Button>
        <Button size="sm" onClick={() => run("publish")} disabled={busy !== null}>
          {busy === "publish" ? "Publishing…" : "Publish now"}
        </Button>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => run("unpublish")}
          disabled={busy !== null}
        >
          Cancel
        </Button>
      </div>
    );
  }

  /* ── Published: the only move left is back ───────────────────────────── */
  if (status === "published") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          On the site
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("unpublish")}
          disabled={busy !== null}
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          {busy === "unpublish" ? "Taking down…" : "Take down"}
        </Button>
      </div>
    );
  }

  /* ── Picking a date ──────────────────────────────────────────────────── */
  if (picking) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="sr-only" htmlFor="publish-at">
          Publish at
        </label>
        <input
          id="publish-at"
          type="datetime-local"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          className="focus-ring h-10 rounded-md border border-border bg-background px-2.5 text-[13px]"
        />
        <Button
          size="sm"
          onClick={() => run("schedule", localToIso(when))}
          disabled={busy !== null || !when}
        >
          {busy === "schedule" ? "Scheduling…" : "Schedule"}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setPicking(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  /* ── A draft ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Schedule
      </Button>
      <Button size="sm" onClick={() => run("publish")} disabled={busy !== null}>
        {busy === "publish" ? "Publishing…" : "Publish"}
      </Button>
    </div>
  );
}

/** What to say afterwards, in terms of what the reader can now do. */
function told(action: Action, story: Story): [string, string] {
  if (action === "unpublish") {
    return ["Taken down", "Readers can no longer open it. The date it ran is kept."];
  }
  if (action === "schedule") {
    return ["Scheduled", `It appears ${formatWhen(story.publishedAt)}.`];
  }
  return ["Published", "The piece is on the site."];
}

/**
 * Tomorrow at nine, as the value a `datetime-local` input wants.
 *
 * A default rather than an empty field, because an empty one makes the writer
 * type a date format before they can express "later". Tomorrow morning is the
 * common case and is trivially edited into any other; it is also safely in the
 * future, which is what the API requires and what an empty field would have
 * let them get wrong on the first try.
 */
function defaultSchedule(): string {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(9, 0, 0, 0);
  return toLocalInput(at);
}

/**
 * `datetime-local` speaks wall-clock time with no zone. These two convert
 * between it and the instants the API deals in, in the browser's own zone —
 * which is the zone the writer meant, since they typed the time while sitting
 * in it.
 */
function toLocalInput(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function localToIso(value: string): string {
  return new Date(value).toISOString();
}

/** A date a person can read, or a plain admission that there isn't one. */
function formatWhen(value: string): string {
  if (!value) return "at a date not yet set";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "at a date not yet set";
  return at.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
