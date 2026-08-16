"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders its children only once the section is close to the viewport.
 *
 * This is for genuinely heavy below-the-fold work — a chart bundle, a map, a
 * grid of embeds. It is deliberately *not* used for ordinary text and cards:
 * deferring those would break in-page search, hurt SEO, and save nothing.
 *
 * The `rootMargin` starts the work a screen early so the content is usually
 * already there by the time the reader arrives, and the reserved `minHeight`
 * keeps the scrollbar honest so nothing jumps when it mounts.
 */
export function LazySection({
  children,
  fallback = null,
  minHeight = 240,
  rootMargin = "600px 0px",
}: {
  children: ReactNode;
  fallback?: ReactNode;
  /** Space held while the section is still deferred, in pixels. */
  minHeight?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // No IntersectionObserver (a very old browser, or the server): render
  // immediately rather than hiding content behind a capability that is missing.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : fallback}
    </div>
  );
}
