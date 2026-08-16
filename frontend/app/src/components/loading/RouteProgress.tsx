"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The thin bar at the top of the viewport during a route change.
 *
 * Navigation start is detected by watching link clicks in the capture phase,
 * and completion by the pathname actually changing. That ordering matters:
 * the bar is driven by real navigation state, so it never sits at 90% waiting
 * on a timer, and a fast route completes it immediately rather than making the
 * reader watch an animation finish.
 *
 * The approach to progress is the honest one — it eases toward 90% while the
 * route is in flight and jumps to 100% the moment it lands. It never claims to
 * know a percentage it cannot know.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const settle = useRef<number | undefined>(undefined);

  // Start on any same-origin link click that will actually navigate.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;

      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Same page — nothing will load, so don't imply that it will.
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }

      setActive(true);
      setProgress(0.08);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Creep toward 90% while in flight — never past it.
  useEffect(() => {
    if (!active) return;
    timer.current = window.setInterval(() => {
      setProgress((p) => (p >= 0.9 ? p : p + (0.9 - p) * 0.16));
    }, 180);
    return () => window.clearInterval(timer.current);
  }, [active]);

  // The route landed: complete, then fade out.
  useEffect(() => {
    if (!active) return;
    setProgress(1);
    settle.current = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, reduced ? 0 : 260);
    return () => window.clearTimeout(settle.current);
    // Deliberately keyed on the destination, not on `active`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px]"
    >
      <div
        className={cn(
          "h-full origin-left bg-accent",
          !reduced && "transition-[transform,opacity]",
          "duration-normal ease-entrance",
        )}
        style={{
          transform: `scaleX(${progress})`,
          opacity: active ? 1 : 0,
        }}
      />
    </div>
  );
}
