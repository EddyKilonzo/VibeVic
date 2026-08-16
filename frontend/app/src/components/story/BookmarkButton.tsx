"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { seconds, transitions } from "@/lib/motion";
import { useBookmarks } from "@/context/BookmarksProvider";

export interface BookmarkButtonProps {
  /** Stable key for the saved item — a story slug, or `video:<id>`. */
  itemId: string;
  title: string;
  variant?: "floating" | "inline" | "icon";
  className?: string;
}

/**
 * Save control.
 *
 * The confirmation is the icon itself: it fills, pops once, and a ring
 * expands out and dissolves. A toast follows quietly for the reader who was
 * looking elsewhere, but the button alone is enough to know it worked —
 * which is the point of a micro-interaction.
 */
export function BookmarkButton({ itemId, title, variant = "icon", className }: BookmarkButtonProps) {
  const { has, toggle } = useBookmarks();
  const reduced = useReducedMotion();
  const saved = has(itemId);
  const [pulseKey, setPulseKey] = useState(0);

  const onClick = () => {
    const nowSaved = toggle(itemId, title);
    if (nowSaved) setPulseKey((k) => k + 1);
  };

  const inline = variant === "inline";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      whileTap={reduced ? undefined : { scale: 0.9 }}
      transition={transitions.fast}
      className={cn(
        "focus-ring relative inline-flex items-center justify-center gap-2",
        "transition-colors duration-normal",
        variant === "floating" &&
          "glass tap-square h-10 w-10 rounded-full text-primary shadow-sm hover:text-accent",
        variant === "icon" && "h-11 w-11 rounded-md text-muted-foreground hover:text-primary",
        inline &&
          "h-11 rounded-md border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary",
        saved && "text-accent hover:text-accent",
        className,
      )}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        {/* One ring, expanding outward and fading — fired only on save. */}
        <AnimatePresence>
          {!reduced && pulseKey > 0 && saved && (
            <motion.span
              key={pulseKey}
              aria-hidden
              className="absolute inset-0 rounded-full border border-accent"
              initial={{ scale: 0.6, opacity: 0.85 }}
              animate={{ scale: 2.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: seconds.slow, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </AnimatePresence>

        <motion.span
          key={saved ? "saved" : "unsaved"}
          initial={reduced ? false : { scale: saved ? 0.7 : 1 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 18 }}
          className="inline-flex"
        >
          <Bookmark
            className="h-4 w-4"
            strokeWidth={1.75}
            fill={saved ? "currentColor" : "none"}
            aria-hidden
          />
        </motion.span>
      </span>

      {inline && <span>{saved ? "Saved" : "Save"}</span>}
    </motion.button>
  );
}
