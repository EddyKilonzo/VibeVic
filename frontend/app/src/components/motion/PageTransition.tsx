"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { bezier, seconds } from "@/lib/motion";
import { refreshScrollTriggers } from "@/lib/gsap";

/**
 * Route change transition.
 *
 * Kept to a short cross-fade with a 4px settle: navigation speed matters far
 * more than a cinematic hand-off, and the outgoing frame must never delay the
 * incoming page by anything a reader would call waiting.
 *
 * `mode="wait"` guarantees the old page is gone before the new one measures
 * itself, which is what keeps GSAP's ScrollTriggers from being created against
 * a scroll height that is about to change.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  // New routes land at the top; back/forward keeps the browser's position.
  useEffect(() => {
    const state = location.state as { keepScroll?: boolean } | null;
    if (!state?.keepScroll) window.scrollTo(0, 0);
  }, [location.pathname, location.state]);

  if (reduced) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" onExitComplete={refreshScrollTriggers}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0, transition: { duration: seconds.normal, ease: bezier.easeOut } }}
        exit={{ opacity: 0, y: -4, transition: { duration: seconds.fast, ease: bezier.ease } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
