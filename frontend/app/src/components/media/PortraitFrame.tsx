import Image from "next/image";
import type { Portrait } from "@/data/portraits";
import { cn } from "@/lib/utils";

/**
 * A portrait at a small, known display size.
 *
 * The source files are 1080×1440. Handing one of those to a 40px byline avatar
 * ships a megapixel to paint a thumbnail, so the small placements go through
 * `next/image`, which emits a correctly-sized WebP and a 1x/2x srcset. The
 * large editorial frames keep using `ImageReveal`, where the source width is
 * close to the display width and the wipe entrance is wanted.
 *
 * `alt` defaults to empty: next to a byline or a name the text already carries
 * the attribution, and a screen reader repeating "Victor Kiplimo, portrait of
 * Victor Kiplimo" is worse than silence. Pass `describe` where the picture is
 * the only thing identifying him.
 */
export function PortraitFrame({
  portrait,
  size,
  describe = false,
  priority = false,
  className,
}: {
  portrait: Portrait;
  /** Rendered size in CSS pixels, on the longest edge. */
  size: number;
  describe?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={portrait.src}
      alt={describe ? portrait.alt : ""}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-cover object-top", className)}
    />
  );
}
