"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarClock, Check } from "lucide-react";
import { update, useNewsroom } from "@/data/newsroom/useNewsroom";
import type { Deadline } from "@/data/newsroom/types";
import { useAllStories } from "@/hooks/useStories";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
import { newsroomPath } from "@/lib/newsroom-path";

/**
 * What is due, on the screen a writer opens first.
 *
 * ── Why a deadline needs to be somewhere other than its story ────────────
 * `Deadline` is workable from the piece it belongs to, which is the right
 * place to set one. It is the wrong place to read one: a deadline you have to
 * remember to go and look at is a reminder that reminds nobody. The question
 * "what is due" is asked across every piece at once, in the morning, before
 * you have decided which piece you are working on.
 *
 * ── What it shows, and what it will not ──────────────────────────────────
 * The next five that are not done, soonest first, overdue ones marked. Not a
 * count of how many are late, not a percentage completed, and no colour
 * grading beyond "this one has passed" — a dashboard that scores somebody
 * against their own to-do list is making a judgement it is not entitled to.
 * Overdue is a fact about the clock. Everything else would be an opinion.
 *
 * ── Ticking one off happens here ─────────────────────────────────────────
 * Because it is the only thing anybody wants to do from this screen, and
 * sending them to the story workspace to change a boolean would mean four
 * clicks and a lost place. The write is the ordinary record update, so the
 * concurrency check and the failure sentence are the ones every other panel
 * gets.
 */
export function DueStrip() {
  const {
    newsroom: { deadlines },
    loading,
  } = useNewsroom("deadlines");
  const { data: allStories } = useAllStories();

  const due = useMemo(() => {
    return deadlines
      .filter((deadline) => !deadline.done)
      .slice()
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 5);
  }, [deadlines]);

  const titleFor = (storyId?: string) =>
    storyId ? allStories?.find((story) => story.id === storyId)?.title : undefined;

  const tick = async (deadline: Deadline) => {
    const result = await update("deadlines", deadline.id, { done: true });
    if (!result.ok) notify.error("Not marked done", result.message);
  };

  return (
    <div>
      <p className="rule-label">Due next</p>

      {due.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {loading
            ? "Reading the newsroom."
            : "Nothing outstanding. Deadlines are set on a piece, under the draft."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {due.map((deadline) => {
            const late = new Date(deadline.dueAt) < new Date();
            const story = titleFor(deadline.storyId);

            return (
              <li key={deadline.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => void tick(deadline)}
                  aria-label={`Mark "${deadline.label}" done`}
                  title="Mark done"
                  className="focus-ring tap mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-transparent transition-colors hover:border-primary hover:text-primary"
                >
                  <Check className="h-3 w-3" aria-hidden />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {deadline.label}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                    <span className={cn(late && "font-semibold text-destructive")}>
                      {when(deadline.dueAt)}
                      {late && " — overdue"}
                    </span>
                    {story && deadline.storyId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link
                          href={newsroomPath(`/stories/${deadline.storyId}`)}
                          className="focus-ring truncate transition-colors hover:text-primary"
                        >
                          {story}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The date and the time, because the time of day is half of the promise. */
function when(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "no date";
  return at.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
