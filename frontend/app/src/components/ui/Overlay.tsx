"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { cn } from "@/lib/utils";
import { seconds, transitions } from "@/lib/motion";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export type OverlayFrom = "top" | "bottom" | "right" | "center";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Where the panel comes from. */
  from?: OverlayFrom;
  label: string;
  className?: string;
  panelClassName?: string;
}

const panelMotion: Record<
  OverlayFrom,
  { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition }
> = {
  top: {
    initial: { y: -24, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -16, opacity: 0 },
  },
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
  },
  right: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
  },
  center: {
    initial: { y: 14, scale: 0.98, opacity: 0 },
    animate: { y: 0, scale: 1, opacity: 1 },
    exit: { y: 8, scale: 0.99, opacity: 0 },
  },
};

/**
 * The shared modal surface behind search, the share sheet and the mobile menu.
 *
 * Handles the parts that are easy to get wrong once and then wrong everywhere:
 * Escape to close, a focus trap, focus returned to the trigger, body scroll
 * lock, and — via AnimatePresence — an exit animation that actually completes
 * before the panel unmounts.
 */
export function Overlay({
  open,
  onClose,
  children,
  from = "center",
  label,
  className,
  panelClassName,
}: OverlayProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useLockBodyScroll(open);

  // Remember the trigger while opening; hand focus back on close.
  useEffect(() => {
    if (open) {
      restoreTo.current = document.activeElement as HTMLElement | null;
      return;
    }
    restoreTo.current?.focus?.();
    restoreTo.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Portals need a real DOM node, which does not exist during prerender. The
  // overlay is closed on first paint anyway, so rendering nothing on the server
  // costs the reader nothing and keeps every page statically renderable.
  if (typeof document === "undefined") return null;

  const spec = panelMotion[from];
  const panelTransition = reduced
    ? { duration: 0 }
    : from === "bottom" || from === "right"
      ? transitions.sheet
      : transitions.normal;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex",
            from === "bottom" && "items-end",
            from === "top" && "items-start",
            from === "right" && "justify-end",
            from === "center" && "items-start justify-center",
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.div
            aria-hidden
            onClick={onClose}
            className="absolute inset-0 bg-brand-ink-deep/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : seconds.normal }}
          />
          <motion.div
            ref={panelRef}
            className={cn("relative w-full", panelClassName)}
            initial={reduced ? false : spec.initial}
            animate={spec.animate}
            exit={reduced ? { opacity: 0 } : spec.exit}
            transition={panelTransition}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
