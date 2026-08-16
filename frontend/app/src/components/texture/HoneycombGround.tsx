"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The page ground, with a pointer response.
 *
 * The lattice picks up a little more ink in a soft pool around the cursor and
 * lets it go again when the pointer leaves. It is deliberately the quietest
 * interaction in the product: a wide radius, a slow fade, and a tint close
 * enough to the resting colour that you register it as the paper catching the
 * light rather than as an effect firing. Nothing moves, nothing reflows, and
 * text contrast is untouched — the glow paints behind content on its own
 * layer.
 *
 * Three things keep it from becoming a distraction:
 *
 *  - **It only exists for a real pointer.** Gated on `(hover: hover) and
 *    (pointer: fine)` in CSS, and the listener is never attached otherwise, so
 *    a phone pays nothing for it.
 *  - **It is off under `prefers-reduced-motion`.** A field that tracks the
 *    cursor is motion, whatever it is made of.
 *  - **It updates once per frame.** Pointer events fire far faster than the
 *    screen refreshes; writing two custom properties per move would be work
 *    thrown away. A single rAF write per frame keeps this off the main
 *    thread's critical path entirely — the properties only feed a composited
 *    mask, so no layout or paint of the content is involved.
 */
export function HoneycombGround({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined" || !window.matchMedia) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || calm.matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      node.style.setProperty("--comb-x", `${x}px`);
      node.style.setProperty("--comb-y", `${y}px`);
    };

    const onMove = (e: PointerEvent) => {
      // Viewport coordinates, because the layer they drive is `position:
      // fixed`. Reading them straight off the event also avoids a
      // `getBoundingClientRect()` — a forced layout — on every pointer move.
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
      node.dataset.pointer = "1";
    };

    const onLeave = () => {
      delete node.dataset.pointer;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className={cn("honeycomb honeycomb-live", className)}>
      {children}
    </div>
  );
}
