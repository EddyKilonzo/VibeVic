"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Play } from "lucide-react";
import { embedUrl, type Video } from "@/data/videos";
import { VideoPoster } from "./VideoPoster";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { useVoice } from "@/context/VoiceProvider";

/**
 * YouTube embed, loaded only when asked for.
 *
 * The card renders a poster frame and a play control; the iframe is not
 * created until the viewer presses it. That is worth doing for three separate
 * reasons: a YouTube iframe costs upwards of a megabyte and blocks the main
 * thread while it boots, six of them on one page would dominate the load, and
 * nothing from Google is contacted until the viewer has actually chosen to
 * watch. `youtube-nocookie.com` handles the rest.
 *
 * Pressing play also stops any narration — two voices at once is the one
 * failure mode a reading assistant must never have.
 */
export function VideoEmbed({
  video,
  className,
  priority = false,
  onPlay,
}: {
  video: Video;
  className?: string;
  priority?: boolean;
  /**
   * Fired once, when the viewer presses play and the iframe is created.
   *
   * The page above uses it to decide whether the player is worth keeping on
   * screen — there is no point docking a poster nobody has started.
   */
  onPlay?: () => void;
}) {
  const [active, setActive] = useState(false);
  const reduced = useReducedMotion();
  const { stop, state } = useVoice();

  const start = () => {
    if (state === "playing" || state === "paused") stop();
    setActive(true);
    onPlay?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-brand-ink-deep shadow-floating",
        video.format === "short" ? "aspect-[9/16]" : "aspect-video",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {!active && (
          <motion.button
            type="button"
            onClick={start}
            aria-label={`Play ${video.title} on YouTube`}
            className="group absolute inset-0 h-full w-full focus-ring"
            exit={reduced ? { opacity: 0 } : { opacity: 0 }}
            transition={transitions.fast}
          >
            <VideoPoster
              id={video.id}
              priority={priority}
              className="media-zoom absolute inset-0"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-brand-ink-deep/70 via-transparent to-transparent"
            />

            <motion.span
              aria-hidden
              className="glass absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-primary"
              whileHover={reduced ? undefined : { scale: 1.06 }}
              whileTap={reduced ? undefined : { scale: 0.95 }}
              transition={transitions.fast}
            >
              <Play className="ml-1 h-6 w-6" fill="currentColor" />
            </motion.span>

            <span className="absolute bottom-3 right-3 rounded bg-brand-ink-deep/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {video.duration}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {active && (
        <motion.iframe
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitions.normal}
          className="absolute inset-0 h-full w-full"
          src={embedUrl(video.id, true)}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </div>
  );
}
