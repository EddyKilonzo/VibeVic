"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * How many days running the newsroom has been opened.
 *
 * ── What this is for, and the line it does not cross ─────────────────────
 * Writing is a habit before it is anything else, and the useful thing a tool
 * can say about a habit is "you have shown up seven days running".
 *
 * It is not a target, a goal, or a score. There is no word count to hit, no
 * red state, and nothing described as broken — a run that has ended is simply
 * not the current one, and the longest still stands in the record. The rest of
 * this product refuses to rank a journalist's ideas on the grounds that
 * software has no business claiming to know which story matters; a streak that
 * scolded somebody for taking a Sunday off would be the same claim about their
 * week.
 *
 * ── The fortnight is the working, not decoration ─────────────────────────
 * Fourteen squares, one per day, filled where the newsroom was opened. A
 * number with no working is a number a person has to take on trust, and the
 * squares are what make "eleven days" checkable at a glance — including the
 * gap in the middle that explains why it is not fourteen.
 *
 * ── Failure is silence ───────────────────────────────────────────────────
 * If the request fails the card renders nothing at all. Every other panel on
 * this screen reports its own errors because the writer came for what is in
 * them; nobody opens a dashboard for the streak, and an error message about
 * one would be the product complaining about itself in the corner of a screen
 * somebody is using for work.
 */

interface Streak {
  current: number;
  longest: number;
  activeToday: boolean;
  lastActiveOn: string | null;
  days: string[];
}

export function StreakCard() {
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    let live = true;

    /*
     * Record today, then read the streak back.
     *
     * In that order, and awaited rather than fired together: the read has to
     * include today or the card says "0" to somebody who is looking at it,
     * which is both wrong and the least forgivable moment to be wrong. The
     * write is idempotent, so this costs one row the first time each day and
     * nothing afterwards.
     */
    void (async () => {
      try {
        await fetch("/api/newsroom/activity", { method: "POST", cache: "no-store" });
        const response = await fetch("/api/newsroom/activity", { cache: "no-store" });
        if (!response.ok) return;
        const value = (await response.json()) as Streak;
        if (live) setStreak(value);
      } catch {
        // Silence, deliberately — see the note above.
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  const fortnight = useMemo(() => {
    const active = new Set(streak?.days ?? []);
    const out: { day: string; on: boolean }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const at = new Date();
      at.setUTCDate(at.getUTCDate() - i);
      const day = at.toISOString().slice(0, 10);
      out.push({ day, on: active.has(day) });
    }
    return out;
  }, [streak]);

  if (!streak) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            streak.current > 0 ? "bg-accent/12 text-accent" : "bg-secondary text-muted-foreground",
          )}
        >
          <Flame className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-display text-2xl font-semibold leading-none tracking-tight text-foreground">
            {streak.current}
            <span className="ml-1.5 font-sans text-sm font-semibold text-muted-foreground">
              {streak.current === 1 ? "day" : "days"} running
            </span>
          </p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {message(streak)}
          </p>
        </div>
      </div>

      <div className="ml-auto">
        <div className="flex items-end gap-1" aria-hidden>
          {fortnight.map((entry) => (
            <span
              key={entry.day}
              title={entry.day}
              className={cn(
                "h-6 w-2.5 rounded-sm transition-colors",
                entry.on ? "bg-accent" : "bg-secondary",
              )}
            />
          ))}
        </div>
        {/* The squares are decorative; this is what a screen reader gets, and
            it is the same fact rather than a description of the graphic. */}
        <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
          <span className="sr-only">
            Opened the newsroom on {fortnight.filter((d) => d.on).length} of the last 14 days.
          </span>
          <span aria-hidden>Last fortnight</span>
        </p>
      </div>
    </div>
  );
}

/**
 * The second line.
 *
 * Written so that every branch is a statement of fact rather than an
 * instruction. "Longest run: 24 days" is true and worth knowing; "keep it
 * up!" is a tool with opinions about somebody's week.
 */
function message(streak: Streak): string {
  if (streak.current === 0) {
    return streak.longest > 1
      ? `Longest run so far, ${streak.longest} days.`
      : "First day back whenever you are.";
  }
  if (streak.current >= streak.longest) return "That is your longest run yet.";
  return `Longest run so far, ${streak.longest} days.`;
}
