"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * The tags a stagger container is ever given.
 *
 * Narrower than `ElementType` on purpose. Beyond being honest about what this
 * is for, `ElementType` stopped working the moment `@react-three/fiber` joined
 * the project: it augments React's intrinsic elements with every three.js
 * object, and the props of a union that wide intersect to `never`, so a plain
 * `className` becomes a type error in a file that has nothing to do with 3D.
 */
type StaggerTag = "div" | "ul" | "ol" | "section" | "nav";
import { stagger as staggerTokens } from "@/lib/motion";

const DelayContext = createContext<number>(0);
const StepContext = createContext<{ step: number; base: number } | null>(null);

/** Delay (ms) inherited from the nearest <StaggerItem>. */
export function useStaggerDelay(): number {
  return useContext(DelayContext);
}

export interface StaggerProps {
  children: ReactNode;
  /** Gap between children — a token, or milliseconds. */
  step?: keyof typeof staggerTokens | number;
  /** Delay before the first child (ms). */
  delay?: number;
  className?: string;
  as?: StaggerTag;
}

/**
 * Sequences a group of reveals by handing each child a delay through context.
 *
 * Motion can propagate `staggerChildren` through variants, but that only works
 * when every child is a direct motion element. Distributing a delay instead
 * means a stagger survives arbitrary nesting — a card wrapper, a link, a
 * fragment — and the same delay is readable by the GSAP-driven primitives too.
 *
 * Steps are small on purpose: a four-card row finishes in about 200ms.
 */
export function Stagger({
  children,
  step = "normal",
  delay = 0,
  className,
  as: Tag = "div",
}: StaggerProps) {
  const ms = typeof step === "number" ? step : staggerTokens[step] * 1000;
  const value = useMemo(() => ({ step: ms, base: delay }), [ms, delay]);

  return (
    <StepContext.Provider value={value}>
      <Tag className={className}>{children}</Tag>
    </StepContext.Provider>
  );
}

export interface StaggerItemProps {
  children: ReactNode;
  index: number;
  /** Caps cumulative delay so the last item of a long list never feels late. */
  max?: number;
  /**
   * Grid placement for this item — `lg:col-span-3` and the like.
   *
   * Supplying it makes the item render a real wrapper element. Without it the
   * component stays purely a context provider and adds nothing to the DOM,
   * which is what keeps it usable inside a grid whose children must be direct
   * descendants.
   */
  className?: string;
}

export function StaggerItem({ children, index, max = 8, className }: StaggerItemProps) {
  const ctx = useContext(StepContext);
  const parent = useContext(DelayContext);
  const delay = ctx ? ctx.base + Math.min(index, max) * ctx.step : parent;

  return (
    <DelayContext.Provider value={delay}>
      {className ? <div className={className}>{children}</div> : children}
    </DelayContext.Provider>
  );
}
