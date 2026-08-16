"use client";

import { List, Minus, Plus, Type } from "lucide-react";
import type { Story } from "@/data/types";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";

/** Multipliers on the article's clamped base size. 1 is the typeset default. */
const STEPS = [0.9, 1, 1.15, 1.3] as const;

/**
 * Reader controls for a single article: text size, and a jump to any section.
 *
 * This is the mobile counterpart to the desktop margin index, and text size is
 * the control readers actually reach for on a phone — a fixed measure that
 * suits a 6-inch screen at arm's length does not suit the same screen held
 * close, and the browser's own zoom moves the whole layout rather than the
 * prose.
 *
 * The choice is remembered per device, so it is set once rather than on every
 * article. It multiplies the article's own clamped size instead of replacing
 * it, which means the fluid scale still applies underneath and the ratios
 * between body, headings and quotes never break.
 */
export function ReadingControls({
  story,
  onOpenSections,
  className,
}: {
  story: Story;
  /** Opens the section sheet. Omitted when the piece has too few headings. */
  onOpenSections?: () => void;
  className?: string;
}) {
  const [step, setStep] = useLocalStorage("vv:reading-scale", 1);
  const index = STEPS.indexOf(step as (typeof STEPS)[number]);
  const safeIndex = index === -1 ? 1 : index;

  /**
   * Step by a delta, computed from the value at the time of the update.
   *
   * Deriving the next step from the rendered index instead loses a click when
   * two land in the same tick — both read the same stale index and the second
   * writes the value the first already did.
   */
  const step_ = (delta: number) =>
    setStep((current) => {
      const at = STEPS.indexOf(current as (typeof STEPS)[number]);
      const from = at === -1 ? 1 : at;
      return STEPS[Math.min(STEPS.length - 1, Math.max(0, from + delta))];
    });

  const headings = story.body.filter((b) => b.type === "heading").length;

  return (
    <div
      className={cn(
        "surface-compact flex items-center gap-1 p-1",
        className,
      )}
    >
      <span className="sr-only" aria-live="polite">
        Text size {Math.round(STEPS[safeIndex] * 100)} percent
      </span>

      <Type className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />

      <button
        type="button"
        onClick={() => step_(-1)}
        disabled={safeIndex === 0}
        aria-label="Smaller text"
        className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary disabled:opacity-35"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>

      {/* Four ticks rather than a number: the reader is choosing comfort, not
          setting a value they need to read back. */}
      <span aria-hidden className="flex items-end gap-[3px] px-0.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full transition-colors duration-normal",
              i <= safeIndex ? "bg-primary" : "bg-border",
            )}
            style={{ height: `${8 + i * 3}px` }}
          />
        ))}
      </span>

      <button
        type="button"
        onClick={() => step_(1)}
        disabled={safeIndex === STEPS.length - 1}
        aria-label="Larger text"
        className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary disabled:opacity-35"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>

      {onOpenSections && headings >= 2 && (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={onOpenSections}
            className="focus-ring tap inline-flex items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
          >
            <List className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sections</span>
          </button>
        </>
      )}
    </div>
  );
}

/** The multiplier currently chosen, for the element that applies it. */
export function useReadingScale(): number {
  const [step] = useLocalStorage("vv:reading-scale", 1);
  return typeof step === "number" ? step : 1;
}
