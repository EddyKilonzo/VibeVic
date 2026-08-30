"use client";

import { motion, useReducedMotion } from "motion/react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { useShare, type ShareTarget } from "@/hooks/useShare";
import { ShareSheet } from "./ShareSheet";

export interface ShareButtonProps extends ShareTarget {
  variant?: "floating" | "inline" | "icon";
  className?: string;
}

/**
 * Share, from wherever the piece is.
 *
 * ── Why this exists on a card ────────────────────────────────────────────
 * Sharing used to require opening the piece first. That is backwards for the
 * most common case: a reader scanning a listing already knows which one they
 * want to send to somebody, and making them open it, wait for the article to
 * render, and find the action bar is three steps to do something the card
 * itself has all the information for. The listing is where the decision
 * happens; the control belongs where the decision happens.
 *
 * ── Why it is shaped exactly like BookmarkButton ─────────────────────────
 * Because it sits next to it. Two floating controls in one corner of a card
 * that disagree about size, glass or press behaviour read as two features
 * bolted on at different times. The variants, the geometry and the tap
 * treatment are deliberately copied rather than reinvented.
 *
 * ── The micro-interaction, and what it is for ────────────────────────────
 * A press dips the button; the icon lifts and tilts a few degrees on hover.
 * That is all. Saving gets the louder confirmation — a fill, a pop, an
 * expanding ring — because saving is a state change with a result the reader
 * needs to see. Sharing is a handoff: the platform sheet or our own opens
 * immediately, and *that* is the feedback. A second celebration underneath a
 * sheet that is already sliding up is noise competing with the thing the
 * reader is now looking at.
 */
export function ShareButton({
  title,
  text,
  path,
  variant = "icon",
  className,
}: ShareButtonProps) {
  const reduced = useReducedMotion();
  const { share, sheetOpen, closeSheet } = useShare({ title, text, path });

  const inline = variant === "inline";

  return (
    <>
      <motion.button
        type="button"
        onClick={(event) => {
          /*
           * Cards are a single big link, and this button is rendered outside
           * that <a> so a press can never navigate. The stop is belt and
           * braces for the layouts where it ends up inside one — a share
           * control that silently opens the article instead is worse than no
           * control, because the reader does not know what they pressed.
           */
          event.stopPropagation();
          share();
        }}
        aria-label={`Share ${title}`}
        whileTap={reduced ? undefined : { scale: 0.9 }}
        transition={transitions.fast}
        className={cn(
          "focus-ring group/share relative inline-flex items-center justify-center gap-2",
          "transition-colors duration-normal",
          variant === "floating" &&
            "glass tap-square h-10 w-10 rounded-full text-primary shadow-sm hover:text-accent",
          variant === "icon" && "h-11 w-11 rounded-md text-muted-foreground hover:text-primary",
          inline &&
            "h-11 rounded-md border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary",
          className,
        )}
      >
        <Share2
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-normal ease-entrance",
            "group-hover/share:-translate-y-px group-hover/share:rotate-[8deg]",
            "motion-reduce:transform-none",
          )}
          aria-hidden
        />
        {inline && <span>Share</span>}
      </motion.button>

      {/*
        Mounted only once the platform has declined or is absent, so a phone
        that opens its own sheet never pays for ours — and the two can never
        be on screen at the same time.
      */}
      {sheetOpen && (
        <ShareSheet title={title} path={path} open onClose={closeSheet} />
      )}
    </>
  );
}
