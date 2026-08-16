"use client";

import { useCallback } from "react";
import type { Story } from "@/data/types";
import { LineIndex } from "@/components/reactbits";

/**
 * A ruled section index pinned beside a long article.
 *
 * Built from the piece's own H2s — the same headings the voice engine turns
 * into chapters — so a writer who structures their article gets both a jump
 * index and an audio table of contents from one act.
 *
 * Desktop only, and deliberately so: on a phone there is no gutter to put it
 * in, and a collapsible index above the article would push the first paragraph
 * below the fold to solve a problem short screens do not have. It is also
 * `aria-hidden` — the headings are already in the document, and a screen
 * reader has a far better heading index built in than this one.
 */
export function ArticleIndex({ story }: { story: Story }) {
  const headings = story.body.filter(
    (block): block is Extract<typeof block, { type: "heading" }> => block.type === "heading",
  );

  const jump = useCallback(
    (index: number) => {
      const target = headings[index];
      if (!target) return;
      // ArticleBody tags every block with `data-block-id`; the index reuses
      // that rather than adding a second id scheme to keep in sync.
      document.querySelector(`[data-block-id="${target.id}"]`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    },
    [headings],
  );

  // Two headings is a list, not an index.
  if (headings.length < 3) return null;

  return (
    <aside
      aria-hidden
      className="pointer-events-auto fixed left-6 top-1/2 z-20 hidden w-[190px] -translate-y-1/2 xl:block"
    >
      <LineIndex items={headings.map((h) => h.text)} onSelect={jump} />
    </aside>
  );
}
