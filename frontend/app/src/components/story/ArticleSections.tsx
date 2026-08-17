"use client";

import type { Story } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * The article's sections, in the sidebar.
 *
 * ── Why this replaced the floating margin rail ───────────────────────────
 * The index used to be a `position: fixed` rail in the left gutter. Two
 * things were wrong with that and neither was fixable by tuning it: it lived
 * outside the page, so it followed the reader over the related reports and
 * over the footer, still listing sections of a piece they had finished; and
 * at any weight where it could actually be read it competed with the sentence
 * beside it. An index belongs in the layout. Here it scrolls with the page,
 * stops when the page stops, and is quiet because it is sitting in a column
 * of its own rather than in the margin of the prose.
 *
 * The current section is marked with a rule, a colour and `aria-current` —
 * three signals, so it does not depend on anyone distinguishing two blues.
 */
export function ArticleSections({
  story,
  activeIndex,
  className,
}: {
  story: Story;
  /** From the scroll spy. -1 before the first heading. */
  activeIndex: number;
  className?: string;
}) {
  const headings = story.body.filter(
    (block): block is Extract<typeof block, { type: "heading" }> => block.type === "heading",
  );

  // Two headings is a list, not an index.
  if (headings.length < 3) return null;

  const jump = (id: string) => {
    document.querySelector(`[data-block-id="${id}"]`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <nav aria-label="Sections in this story" className={cn(className)}>
      <p className="rule-label">In this story</p>

      <ol className="mt-4 flex flex-col">
        {headings.map((heading, i) => {
          const here = i === activeIndex;

          return (
            <li key={heading.id}>
              <button
                type="button"
                onClick={() => jump(heading.id)}
                aria-current={here ? "true" : undefined}
                className={cn(
                  "focus-ring group flex w-full gap-3 border-l-2 py-2.5 pl-3 pr-1 text-left transition-colors duration-normal",
                  here
                    ? "border-accent text-primary"
                    : "border-border text-muted-foreground hover:border-accent/50 hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums",
                    here ? "text-accent" : "text-muted-foreground/70",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "min-w-0 text-[13px] leading-snug",
                    here && "font-semibold",
                  )}
                >
                  {heading.text}
                  {here && <span className="sr-only"> — you are here</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
