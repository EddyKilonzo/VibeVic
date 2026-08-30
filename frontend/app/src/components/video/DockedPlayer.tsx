"use client";

import { useRef, useState, type ReactNode } from "react";
import { useInView } from "motion/react";
import { X } from "lucide-react";
import type { Video } from "@/data/videos";
import { cn } from "@/lib/utils";

/**
 * Keeps a report playing while the viewer reads on past it.
 *
 * Scroll down from a playing video to the related reports and the player would
 * otherwise be gone — audio still running from somewhere above, nothing to
 * pause it with. This parks it in the corner instead, the way a video site
 * would.
 *
 * ── The one constraint that shapes the whole component ───────────────────
 * The player is a YouTube iframe, and **moving an iframe in the DOM reloads
 * it** — the video would restart from zero every time it docked or undocked,
 * which is worse than not docking at all. So nothing is re-parented here. The
 * children stay in exactly one place in the tree and only their wrapper's
 * positioning changes, from `absolute inset-0` to `fixed` in the corner. The
 * outer element keeps the aspect box either way, so the page never jumps when
 * the player leaves it.
 *
 * It only ever engages after the viewer has pressed play, which also means it
 * cannot fire for someone who never chose to load anything from YouTube.
 */
export function DockedPlayer({
  video,
  playing,
  children,
}: {
  video: Video;
  /** Whether the embed has actually been started. */
  playing: boolean;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);

  // A third of the player still on screen counts as watching it in place.
  const inPlace = useInView(anchor, { amount: 0.35 });

  // Scrolling back up to the player clears a dismissal, so putting the dock
  // away is a decision about this trip down the page, not a permanent one.
  // Adjusted during render rather than in an effect: React re-runs this
  // component before committing, so the dock never paints for the frame
  // between the player returning and an effect noticing.
  const [wasInPlace, setWasInPlace] = useState(inPlace);
  if (inPlace !== wasInPlace) {
    setWasInPlace(inPlace);
    if (inPlace && dismissed) setDismissed(false);
  }

  const docked = playing && !inPlace && !dismissed;
  const portrait = video.format === "short";

  return (
    <div
      ref={anchor}
      className={cn("relative", portrait ? "aspect-[9/16]" : "aspect-video")}
    >
      <div
        className={cn(
          // Nothing here animates its position. A transform on a container
          // holding a cross-origin iframe forces the compositor to re-rasterise
          // it, and on some builds to flash it black — the exact frames a
          // viewer would be watching. It appears, and it is there.
          docked
            ? [
                "fixed bottom-4 right-4 z-50 overflow-hidden rounded-xl shadow-primary ring-1 ring-white/15",
                portrait ? "w-[150px] sm:w-[190px]" : "w-[240px] sm:w-[340px]",
              ]
            : "absolute inset-0",
        )}
      >
        {children}

        {docked && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Close the floating player"
            // 28px is deliberate — the player is 240px wide on a phone and a
            // 44px button would be a quarter of it. `tap-reach` leaves the
            // circle this size and extends the touch target around it, which
            // matters more here than anywhere: this is the only way to get rid
            // of a player that is floating over what you were reading.
            className="focus-ring tap-reach absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-ink-deep/80 text-white transition-colors hover:bg-brand-ink-deep"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
