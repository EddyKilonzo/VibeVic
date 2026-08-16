"use client";

import { useState } from "react";
import { posterFor } from "@/data/videos";
import { cn } from "@/lib/utils";

/**
 * A report's poster frame, at the best resolution that actually exists.
 *
 * YouTube generates `maxresdefault` (1280×720) for most uploads but not all —
 * Shorts and older videos often stop at `hqdefault` (480×360), and requesting
 * a frame that does not exist returns YouTube's grey placeholder rather than a
 * 404. So the only reliable way to get the sharp frame when it is there is to
 * ask for it and step down when the request fails.
 *
 * The step-down happens once per id and is invisible: the element keeps its
 * box the whole time, so a fallback never moves the layout.
 */
export function VideoPoster({
  id,
  alt = "",
  className,
  priority = false,
}: {
  id: string;
  alt?: string;
  className?: string;
  /** Skip lazy-loading for a poster that is above the fold. */
  priority?: boolean;
}) {
  const [size, setSize] = useState<"max" | "hq">("max");

  return (
    <img
      src={posterFor(id, size)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // Reserving the intrinsic ratio keeps the box stable before the bytes
      // land, which is what stops a grid of these from settling as it loads.
      width={1280}
      height={720}
      onError={() => setSize((s) => (s === "max" ? "hq" : s))}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
