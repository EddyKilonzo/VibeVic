"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * A blur-up image.
 *
 * The placeholder is a solid tinted block, not a fabricated low-res preview:
 * these images are remote YouTube thumbnails, so there is no real LQIP to
 * embed and inventing one would show the reader a picture that isn't the
 * picture. A tint holds the exact aspect ratio — which is the part that
 * actually prevents layout shift — and dissolves once the real bytes decode.
 *
 * `onLoad` fires after decode for images that arrive from cache too, so the
 * fade never sticks. Under reduced motion the CSS transition is suppressed by
 * the global media query and the image simply appears.
 */
export interface ImageWithBlurPlaceholderProps extends Omit<ImageProps, "onLoad"> {
  /** Ratio-holding wrapper classes — where you put `aspect-[16/9]`. */
  wrapperClassName?: string;
  /** Tint shown while the image loads. Defaults to the muted surface token. */
  placeholderClassName?: string;
}

export function ImageWithBlurPlaceholder({
  wrapperClassName,
  placeholderClassName,
  className,
  ...props
}: ImageWithBlurPlaceholderProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={cn("relative block overflow-hidden bg-muted", wrapperClassName)}>
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 bg-muted transition-opacity duration-slow ease-editorial",
          loaded ? "opacity-0" : "opacity-100",
          !loaded && "skeleton",
          placeholderClassName,
        )}
      />
      <Image
        {...props}
        onLoad={() => setLoaded(true)}
        className={cn(
          "transition-opacity duration-slow ease-editorial",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </span>
  );
}
