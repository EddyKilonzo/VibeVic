"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Quote } from "lucide-react";
import type { Story } from "@/data/types";
import { PROFILE } from "@/data/content";
import { useCopy } from "@/hooks/useCopy";
import { transitions } from "@/lib/motion";

/** Shorter than this is a word, not a quotation. */
const MIN_LENGTH = 12;
/** Longer than this is the article, and copying it whole is not quoting. */
const MAX_LENGTH = 600;

/**
 * Copy a passage with its attribution already attached.
 *
 * Select a sentence in the article and this offers to put it on the clipboard
 * as a quotation — the words in quote marks, then the writer, the piece and
 * the link. The plain browser copy gives you a floating fragment of text that
 * has to be credited by hand, which is exactly the step people skip. On a
 * journalist's own site, making the attributed version the easy one is the
 * whole point.
 *
 * ── Where it does and does not appear ────────────────────────────────────
 * Fine pointers only. A phone raises its own selection menu the moment you
 * lift your finger, and a second control fighting it for the same corner of
 * the screen is worse than not having one. Touch readers still get Share.
 */
export function QuoteSelection({ story, target }: { story: Story; target: RefObject<HTMLElement | null> }) {
  const reduced = useReducedMotion();
  const { copied, copy } = useCopy();
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  // Held so the popover survives the click that dismisses the selection.
  const pending = useRef<string>("");

  const clear = useCallback(() => setSelection(null), []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const onUp = () => {
      // Deferred a tick: on mouseup the selection the browser reports is
      // sometimes still the previous one.
      window.setTimeout(() => {
        const active = window.getSelection();
        const article = target.current;
        if (!active || active.isCollapsed || !article) return clear();

        const text = active.toString().trim().replace(/\s+/g, " ");
        if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) return clear();

        // Only inside the prose. A selection that starts in the byline or runs
        // into the related rail is not a quotation from the piece.
        const range = active.getRangeAt(0);
        if (!article.contains(range.commonAncestorContainer)) return clear();

        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return clear();

        pending.current = text;
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }, 0);
    };

    document.addEventListener("mouseup", onUp);
    document.addEventListener("scroll", clear, { passive: true });
    window.addEventListener("resize", clear);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("scroll", clear);
      window.removeEventListener("resize", clear);
    };
  }, [clear, target]);

  const take = () => {
    const url = `${window.location.origin}/stories/${story.slug}`;
    void copy(`“${pending.current}”\n\n— ${PROFILE.name}, “${story.title}”\n${url}`);
  };

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={transitions.fast}
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: selection.y - 10 }}
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={take}
            className="frost focus-ring press flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold shadow-primary"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
            ) : (
              <Quote className="h-3.5 w-3.5 text-accent" aria-hidden />
            )}
            {copied ? "Quote copied" : "Copy with credit"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
