"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ListMusic,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { formatTime } from "@/lib/format";
import { useVoice } from "@/context/VoiceProvider";
import { AudioBars } from "./AudioBars";
import { FollowAlongToggle, SpeedMenu, VoiceMenu } from "./VoiceControls";

/**
 * The expanded article player.
 *
 * Deliberately not a media player pastiche: no album art, no waveform, no
 * gradient. It is a row of editorial controls that happens to make sound, so
 * it can sit directly under the standfirst without breaking the page's voice.
 *
 * Timing note: the browser's speech API reports no duration and no position,
 * so elapsed and total are *estimated* from word counts and reconciled at
 * every sentence boundary. The scrubber therefore seeks by sentence rather
 * than by millisecond — which is also what makes it useful, since a sentence
 * is the smallest place a listener actually wants to land.
 */
export function VoicePlayer({
  chaptersOpen,
  onToggleChapters,
  className,
}: {
  chaptersOpen: boolean;
  onToggleChapters: () => void;
  className?: string;
}) {
  const {
    state,
    preparing,
    error,
    article,
    segmentIndex,
    elapsed,
    total,
    toggle,
    stop,
    restart,
    nextChapter,
    previousChapter,
    seekToSegment,
  } = useVoice();
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);

  const playing = state === "playing";
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const hasChapters = (article?.chapters.length ?? 0) > 1;

  /** Cumulative start time of each segment, for click-to-seek on the track. */
  const offsets = useMemo(() => {
    if (!article) return [];
    let running = 0;
    return article.segments.map((s) => {
      const start = running;
      running += s.estimatedSeconds;
      return start;
    });
  }, [article]);

  const seekFromTrack = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !article) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetSeconds = ratio * article.totalSeconds;

    // Land on the sentence containing that moment.
    let index = offsets.findIndex((start, i) => {
      const end = offsets[i + 1] ?? article.totalSeconds;
      return targetSeconds >= start && targetSeconds < end;
    });
    if (index < 0) index = article.segments.length - 1;

    seekToSegment(index);
  };

  if (!article) return null;

  return (
    <motion.div
      layout={reduced ? false : "position"}
      transition={transitions.normal}
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-[0_2px_18px_hsl(var(--ink)/0.05)] sm:p-5",
        className,
      )}
    >
      {/* Transport */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={preparing}
          aria-label={playing ? "Pause article" : "Play article"}
          className="focus-ring press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-normal hover:bg-brand-ink-deep disabled:opacity-60"
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
                <Pause className="h-5 w-5" fill="currentColor" aria-hidden />
              ) : (
                <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden />
              )}
            </motion.span>
          </AnimatePresence>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <AudioBars active={playing} className="text-accent" />
              {preparing
                ? "Preparing audio…"
                : state === "ended"
                  ? "Finished"
                  : hasChapters
                    ? article.chapters[article.segments[segmentIndex]?.chapterIndex ?? 0]?.title
                    : "Listening"}
            </p>
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatTime(elapsed)}{" "}
              <span className="text-border">/</span>{" "}
              <span aria-label={`${formatTime(total - elapsed)} remaining`}>
                −{formatTime(Math.max(0, total - elapsed))}
              </span>
            </p>
          </div>

          {/* Scrubber. Slider semantics so it is operable from the keyboard. */}
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(elapsed)}
            aria-valuetext={`${formatTime(elapsed)} of ${formatTime(total)}`}
            onClick={(e) => seekFromTrack(e.clientX)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                seekToSegment(segmentIndex + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                seekToSegment(Math.max(0, segmentIndex - 1));
              }
            }}
            className="focus-ring group relative mt-2 h-6 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full origin-left rounded-full bg-accent"
                style={{ scaleX: progress }}
                transition={{ duration: 0 }}
              />
            </div>
            {/* Chapter ticks double as a table of contents you can see. */}
            {hasChapters &&
              article.chapters.slice(1).map((chapter) => (
                <span
                  key={chapter.index}
                  aria-hidden
                  className="absolute top-1/2 h-[9px] w-px -translate-y-1/2 bg-border"
                  style={{
                    left: `${((offsets[chapter.startSegment] ?? 0) / article.totalSeconds) * 100}%`,
                  }}
                />
              ))}
            <motion.span
              aria-hidden
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-background opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Secondary controls */}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <IconControl label="Restart from the beginning" onClick={restart}>
          <RotateCcw className="h-4 w-4" aria-hidden />
        </IconControl>
        {hasChapters && (
          <>
            <IconControl label="Previous section" onClick={previousChapter}>
              <SkipBack className="h-4 w-4" aria-hidden />
            </IconControl>
            <IconControl label="Next section" onClick={nextChapter}>
              <SkipForward className="h-4 w-4" aria-hidden />
            </IconControl>
          </>
        )}
        <IconControl label="Stop and reset" onClick={stop}>
          <Square className="h-3.5 w-3.5" aria-hidden />
        </IconControl>

        <span aria-hidden className="mx-1 h-5 w-px bg-border" />

        <SpeedMenu />
        <VoiceMenu />

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <FollowAlongToggle />

        {hasChapters && (
          <button
            type="button"
            onClick={onToggleChapters}
            aria-expanded={chaptersOpen}
            className={cn(
              "focus-ring ml-auto inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors duration-normal hover:bg-secondary hover:text-primary",
              chaptersOpen ? "text-primary" : "text-muted-foreground",
            )}
          >
            <ListMusic className="h-3.5 w-3.5" aria-hidden />
            Chapters
          </button>
        )}
      </div>

      {/* Errors are shown in place rather than as a toast — the reader is
          looking right at the control that failed. */}
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.normal}
            className="mt-3 flex items-start gap-2 overflow-hidden text-xs text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function IconControl({
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
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary"
    >
      {children}
    </button>
  );
}
