"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";

export interface WorkspaceTab {
  id: string;
  label: string;
  /** Shown as a superscript count — omitted when zero, never faked. */
  count?: number;
}

/**
 * The Story Workspace tab strip.
 *
 * One story, one screen: the brief's first principle is that reporting should
 * not be scattered across pages you have to remember to visit. Tabs keep the
 * draft and everything behind it in the same place, and the URL is untouched
 * so switching tabs never costs a navigation.
 *
 * Real tab semantics — `role="tablist"`, arrow-key navigation, `aria-selected`
 * — because a keyboard user should be able to move through the workspace the
 * way the markup promises. On a phone the strip scrolls horizontally rather
 * than wrapping into three cramped rows.
 */
export function WorkspaceTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: WorkspaceTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();

  const move = (delta: number) => {
    const index = tabs.findIndex((t) => t.id === active);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next) onChange(next.id);
  };

  return (
    <div
      role="tablist"
      aria-label="Story workspace"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
      className={cn(
        "-mx-4 flex gap-1 overflow-x-auto px-4 pb-px sm:mx-0 sm:px-0",
        "scrollbar-none border-b border-border",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "focus-ring relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium",
              "transition-colors duration-normal",
              selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums">
                {tab.count}
              </span>
            )}
            {selected &&
              (reduced ? (
                <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-primary" />
              ) : (
                <motion.span
                  aria-hidden
                  layoutId="workspace-tab"
                  className="absolute inset-x-2 bottom-0 h-0.5 bg-primary"
                  transition={transitions.layout}
                />
              ))}
          </button>
        );
      })}
    </div>
  );
}

/** Panel wrapper that carries the ARIA wiring so no caller can forget it. */
export function WorkspacePanel({
  id,
  active,
  children,
}: {
  id: string;
  active: string;
  children: React.ReactNode;
}) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="focus-ring pt-7">
      {children}
    </div>
  );
}
