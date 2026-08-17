"use client";

import { ArrowRight } from "lucide-react";
import type { Story } from "@/data/types";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/ui/Overlay";

/**
 * Jump to a section, from a phone.
 *
 * The desktop margin index has nowhere to live on a narrow screen, so the same
 * information becomes a bottom sheet — reachable by thumb, dismissed by the
 * same gesture as every other sheet in the product.
 *
 * Built from the article's own H2s, which are also the voice player's
 * chapters. One act of structuring by the writer, three affordances for the
 * reader.
 */
export function SectionSheet({
  story,
  activeIndex,
  open,
  onClose,
}: {
  story: Story;
  /** Which section the reader is in, from the scroll spy. -1 before the first. */
  activeIndex: number;
  open: boolean;
  onClose: () => void;
}) {
  const headings = story.body.filter(
    (block): block is Extract<typeof block, { type: "heading" }> => block.type === "heading",
  );

  const jump = (id: string) => {
    onClose();
    // After the sheet's exit, so the scroll is not fighting a closing panel.
    window.setTimeout(() => {
      document
        .querySelector(`[data-block-id="${id}"]`)
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
    }, 180);
  };

  return (
    <Overlay open={open} onClose={onClose} from="bottom" label="Sections in this story">
      <div className="pb-2">
        <p className="rule-label px-1 pb-3">In this story</p>
        {/* The section the reader is in is marked, so the sheet answers "where
            am I" as well as "where can I go". Marked with a rule and a colour
            rather than only a colour, and with `aria-current`, so it is not a
            hue doing the work on its own. */}
        <ol className="flex flex-col">
          {headings.map((heading, i) => {
            const here = i === activeIndex;

            return (
              <li key={heading.id}>
                <button
                  type="button"
                  onClick={() => jump(heading.id)}
                  aria-current={here ? "true" : undefined}
                  className={cn(
                    "focus-ring group flex w-full items-center gap-4 rounded-lg py-3.5 pl-3 pr-1 text-left transition-colors hover:bg-secondary",
                    here ? "bg-secondary/70" : "border-l-2 border-transparent",
                    here && "border-l-2 border-accent",
                  )}
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 text-[11px] font-semibold tabular-nums",
                      here ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "font-display min-w-0 flex-1 text-[15px] font-semibold leading-snug",
                      here && "text-primary",
                    )}
                  >
                    {heading.text}
                    {here && <span className="sr-only"> — you are here</span>}
                  </span>
                  <ArrowRight
                    className="nudge-x h-4 w-4 shrink-0 text-muted-foreground group-hover:text-accent"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Overlay>
  );
}
