import { cn } from "@/lib/utils";

/**
 * A margin annotation with a hand-drawn arrow.
 *
 * Editorially this is a sub-editor's note in the margin: it points at one
 * thing and says why it is worth looking at. Visually it is the one informal
 * mark on an otherwise composed page, which is exactly why there should never
 * be more than two of them on a screen.
 *
 * The "handwriting" is Fraunces italic — a face the site already loads —
 * rather than a script webfont. A second font download for six words of
 * decoration is not a trade worth making, and the italic at a slight rotation
 * reads as annotation without pretending to be a real hand.
 *
 * `aria-hidden` throughout: the note repeats what the thing it points at
 * already says, and a screen reader announcing "curved arrow pointing down
 * right" helps nobody.
 */
export interface HeroNoteProps {
  children: string;
  /** Which way the arrow curves away from the text. */
  direction?: "down-right" | "down-left";
  className?: string;
}

export function HeroNote({ children, direction = "down-right", className }: HeroNoteProps) {
  const flip = direction === "down-left";

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none hidden select-none flex-col text-accent lg:flex",
        flip ? "items-end text-right" : "items-start text-left",
        className,
      )}
    >
      <span
        className={cn(
          "font-display max-w-[15ch] text-[15px] font-medium italic leading-[1.35]",
          flip ? "-rotate-2" : "rotate-[-3deg]",
        )}
      >
        {children}
      </span>

      {/* Drawn rather than an icon: the curve has to match the gap between
          the note and its target, which no icon set will happen to do. */}
      <svg
        viewBox="0 0 64 52"
        className={cn("mt-1 h-11 w-14", flip && "-scale-x-100")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3c14 6 24 16 30 30" />
        <path d="M28 34l8.5 -1.5" />
        <path d="M36 33.5l1.5 8" />
      </svg>
    </span>
  );
}
