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
/**
 * A real `maxresdefault` is 1280×720. YouTube's "no such frame" placeholder is
 * 120×90 and arrives with a 200, so anything this small is the placeholder and
 * not a poster.
 */
const PLACEHOLDER_MAX_WIDTH = 200;

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
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      // Reserving the intrinsic ratio keeps the box stable before the bytes
      // land, which is what stops a grid of these from settling as it loads.
      width={1280}
      height={720}
      // `onError` alone was not enough, and this is why some posters were
      // rendering as a grey smear: a missing `maxresdefault` does not 404, it
      // returns a 120×90 grey placeholder with a 200, which loads perfectly
      // and then gets scaled up into a 16:9 card. The size of what actually
      // arrived is the only signal there is.
      onLoad={(event) => {
        const width = event.currentTarget.naturalWidth;
        if (size === "max" && width > 0 && width < PLACEHOLDER_MAX_WIDTH) setSize("hq");
      }}
      onError={() => setSize((s) => (s === "max" ? "hq" : s))}
      // `object-cover` is doing real work on the fallback: `hqdefault` is 4:3
      // with black bars, and covering a 16:9 box crops exactly the 12.5% at
      // each edge that the bars occupy.
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
