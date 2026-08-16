"use client";

import { cn } from "@/lib/utils";

/**
 * Three bars that rise and fall while audio plays.
 *
 * The brief asks for "no large music-style visualiser" — this is the smallest
 * honest signal that sound is coming out, at 14px tall. It is pure CSS
 * (`.audio-bar`), so it costs nothing per frame and stops dead under reduced
 * motion, where the bars simply hold at a fixed height.
 */
export function AudioBars({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex h-3.5 items-end gap-[2px]", className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full bg-current",
            active ? "audio-bar h-full" : "h-[35%] opacity-50",
          )}
        />
      ))}
    </span>
  );
}
