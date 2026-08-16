"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { formatTime } from "@/lib/format";
import { transitions } from "@/lib/motion";
import { useVoice } from "@/context/VoiceProvider";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { AudioBars } from "./AudioBars";

/**
 * Mobile bottom player.
 *
 * Appears only once playback has actually started, so it never occupies the
 * screen speculatively, and sits above the safe-area inset so it clears the
 * home indicator. The article gets matching bottom padding while it is
 * visible (see Story.tsx), so it cannot cover the last paragraph.
 */
export function VoiceMiniPlayer() {
  const { state, article, elapsed, total, toggle, stop, nextChapter, preferences } = useVoice();
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();

  const visible = !desktop && !!article && (state === "playing" || state === "paused");
  const playing = state === "playing";
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: "110%" }}
          animate={reduced ? { opacity: 1 } : { y: 0 }}
          exit={reduced ? { opacity: 0 } : { y: "110%" }}
          transition={transitions.sheet}
          className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
          role="region"
          aria-label="Audio player"
        >
          <div className="glass-strong border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
            {/* Progress doubles as the top edge of the bar. */}
            <div className="h-[2px] w-full bg-border/60">
              <motion.div
                className="h-full origin-left bg-accent"
                style={{ scaleX: progress }}
                transition={{ duration: 0 }}
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play"}
                className="focus-ring press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={playing ? "pause" : "play"}
                    initial={reduced ? false : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                    transition={transitions.fast}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    {playing ? (
                      <Pause className="h-[18px] w-[18px]" fill="currentColor" aria-hidden />
                    ) : (
                      <Play className="ml-0.5 h-[18px] w-[18px]" fill="currentColor" aria-hidden />
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight">{article.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
                  <AudioBars active={playing} className="text-accent" />
                  {formatTime(elapsed)} / {formatTime(total)}
                  <span className="text-border">·</span>
                  {preferences.rate}×
                </p>
              </div>

              <button
                type="button"
                onClick={nextChapter}
                aria-label="Next section"
                className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground"
              >
                <SkipForward className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={stop}
                aria-label="Stop listening"
                className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
