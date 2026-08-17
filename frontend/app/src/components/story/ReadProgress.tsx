"use client";

import { Check } from "lucide-react";
import { useReadState } from "@/hooks/useReadingPosition";
import { cn } from "@/lib/utils";

/**
 * How far into this piece the reader already is — on the card, before they
 * open it.
 *
 * An archive that looks identical whether you have read something or not makes
 * you remember for it. Six articles is already enough to lose track of; this
 * says "you finished that one" and "you were a third of the way into that one"
 * without asking the reader to hold either fact.
 *
 * ── It renders nothing by default ────────────────────────────────────────
 * No mark, no output. Decorating every unopened item with an empty bar and
 * "0% read" would turn a clean archive into a progress dashboard, and would
 * imply the site is keeping a record of things it has no record of. The state
 * is also `null` through the server render and the first client pass, so
 * nothing here can cause a hydration mismatch.
 *
 * Nothing leaves the device: the mark is in this browser's localStorage, put
 * there by the reader's own scrolling. See `useReadingPosition`.
 */
export function ReadProgress({ slug, className }: { slug: string; className?: string }) {
  const state = useReadState(slug);
  if (!state) return null;

  if (state.finished) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent",
          className,
        )}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Read
      </span>
    );
  }

  const percent = Math.round(state.progress * 100);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* A 32px rule rather than a full-width bar. At card width it reads as a
          loading state for the card itself; at this size it is obviously a
          measure of the piece. */}
      <span aria-hidden className="h-1 w-8 overflow-hidden rounded-full bg-border">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.max(6, percent)}%` }}
        />
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {percent}% read
      </span>
    </span>
  );
}
