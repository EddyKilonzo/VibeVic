"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { transitions } from "@/lib/motion";
import { useVoice } from "@/context/VoiceProvider";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { AudioBars } from "./AudioBars";
import { FollowAlongToggle, SpeedMenu, VoiceMenu } from "./VoiceControls";

/**
 * Mobile bottom player.
 *
 * Appears only once playback has actually started, so it never occupies the
 * screen speculatively, and sits above the safe-area inset so it clears the
 * home indicator. The article gets matching bottom padding while it is
 * visible (see Story.tsx), so it cannot cover the last paragraph.
 *
 * ── Why the settings drawer exists ──────────────────────────────────────
 * The full player is a desktop-width row, and on a phone it is scrolled far
 * above the fold the moment listening starts — which left the reading voice
 * and the speed reachable only by scrolling back up to a control they had
 * already left behind. They live here too now, one tap away, in a drawer that
 * is closed by default so the bar stays a bar.
 */
export function VoiceMiniPlayer() {
  const {
    state,
    article,
    elapsed,
    total,
    toggle,
    stop,
    restart,
    nextChapter,
    previousChapter,
    preferences,
  } = useVoice();
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visible = !desktop && !!article && (state === "playing" || state === "paused");
  const playing = state === "playing";
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const hasChapters = (article?.chapters.length ?? 0) > 1;

  /* A drawer left open on a bar that has gone away would spring back open on
     the next article.

     Closing it during render rather than in an effect, which is what React
     asks for when one piece of state has to follow another: the effect version
     rendered the stale open drawer once and then re-rendered to close it, and
     the bar is mounting at that moment anyway. Same pattern as the workspace
     resetting its draft when a different story arrives. */
  const [barWasUp, setBarWasUp] = useState(visible);
  if (barWasUp !== visible) {
    setBarWasUp(visible);
    if (!visible) setSettingsOpen(false);
  }

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

            {/* The drawer sits above the transport, so the menus inside it —
                which all open upward — have the whole screen to open into
                rather than the 56px of bar below them. */}
            <AnimatePresence initial={false}>
              {settingsOpen && (
                <motion.div
                  key="settings"
                  initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={transitions.normal}
                  className="overflow-hidden border-b border-border/60"
                >
                  <div className="flex flex-wrap items-center gap-1 px-2 py-2">
                    <MiniControl label="Restart from the beginning" onClick={restart}>
                      <RotateCcw className="h-4 w-4" aria-hidden />
                    </MiniControl>
                    {hasChapters && (
                      <MiniControl label="Previous section" onClick={previousChapter}>
                        <SkipBack className="h-4 w-4" aria-hidden />
                      </MiniControl>
                    )}

                    <span aria-hidden className="mx-1 h-5 w-px bg-border" />

                    {/* Upward: this row sits on the bottom edge of the
                        screen, so a panel opening downward would open into
                        the home indicator. */}
                    <SpeedMenu placement="up" />
                    <VoiceMenu placement="up" />
                    <FollowAlongToggle />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                onClick={() => setSettingsOpen((v) => !v)}
                aria-expanded={settingsOpen}
                aria-label="Voice and speed"
                className={cn(
                  "focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-normal",
                  settingsOpen ? "bg-secondary text-primary" : "text-muted-foreground",
                )}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
              </button>
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

function MiniControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary"
    >
      {children}
    </button>
  );
}
