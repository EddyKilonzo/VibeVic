"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A self-hosted vertical clip.
 *
 * ── Why it is not just a <video controls> ────────────────────────────────
 * Two reasons, and both are about the reader rather than the markup.
 *
 * It has sound. Nothing on this site plays audio unasked, and a `<video>` left
 * to its own devices in a page full of `autoplay` conventions is one attribute
 * away from breaking that. Play here is a press, always.
 *
 * And it is a megabyte and a half. `preload="none"` means a reader who never
 * touches it pays nothing at all — no manifest, no first frame, no range
 * request. The cost of that is having no poster frame to show, which is what
 * the cover below is for: it is drawn, not decoded, so the card has something
 * to be before anyone commits to downloading the video behind it.
 */
export function FieldClip({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    // The element only gets a source on the first press, so `load` has to be
    // asked for before `play` has anything to play.
    const element = video.current;
    if (!element) return;
    element.load();
    void element.play().catch(() => {
      // Autoplay policy, a codec the device will not take, a file that moved.
      // The controls are visible either way, so the reader still has a button.
    });
  };

  return (
    <div
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-xl bg-brand-ink-deep shadow-primary",
        className,
      )}
    >
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover"
        controls={started}
        playsInline
        preload="none"
        // Not `muted`, and not `autoPlay`. Both are deliberate.
      >
        {started && <source src={src} type="video/mp4" />}
      </video>

      {!started && (
        <button
          type="button"
          onClick={start}
          className="focus-ring group absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary/25 via-brand-ink-deep/60 to-brand-ink-deep"
        >
          <span className="glass flex h-16 w-16 items-center justify-center rounded-full text-primary transition-transform duration-normal ease-spring group-hover:scale-105 motion-reduce:transform-none">
            <Play className="ml-1 h-6 w-6" fill="currentColor" />
          </span>
          <span className="font-display px-6 text-center text-lg font-semibold leading-snug text-white">
            {title}
          </span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">
            Has sound
          </span>
        </button>
      )}
    </div>
  );
}
