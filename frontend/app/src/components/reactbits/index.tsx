"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// The React Bits sources are untyped JSX. Everything above this file imports
// from here instead, so the product only ever sees typed props — and so the
// reduced-motion and touch guards below cannot be forgotten at a call site.
/* eslint-disable @typescript-eslint/no-explicit-any */
import RbCurvedLoop from "./CurvedLoop.jsx";
import RbGooeyNav from "./GooeyNav.jsx";
import RbLineSidebar from "./LineSidebar.jsx";
import RbScrollExpand from "./ScrollExpand.jsx";
import RbScrollStack, { ScrollStackItem as RbScrollStackItem } from "./ScrollStack.jsx";
import RbSpecularButton from "./SpecularButton.jsx";
import RbCountUp from "./RbCountUp.jsx";

const CurvedLoopBase = RbCurvedLoop as any;
const GooeyNavBase = RbGooeyNav as any;
const LineSidebarBase = RbLineSidebar as any;
const ScrollExpandBase = RbScrollExpand as any;
const ScrollStackBase = RbScrollStack as any;
const ScrollStackItemBase = RbScrollStackItem as any;
const SpecularButtonBase = RbSpecularButton as any;
const CountUpBase = RbCountUp as any;

/* ── Curved marquee ──────────────────────────────────────────── */

export interface CurvedMarqueeProps {
  text: string;
  speed?: number;
  curveAmount?: number;
  direction?: "left" | "right";
  className?: string;
}

/**
 * A curved, continuously scrolling band of text.
 *
 * Under reduced motion it renders the same words as a static line rather than
 * disappearing — the words are content, the loop is decoration, and only the
 * decoration should be negotiable.
 *
 * `curveAmount` is capped: the component's viewBox is 120 units tall and the
 * arc's midpoint sits at 40 + curveAmount/2, so anything much past 140 sends
 * the text out of the box and the band renders blank.
 */
export function CurvedMarquee({
  text,
  speed = 1.4,
  curveAmount = 90,
  direction = "left",
  className,
}: CurvedMarqueeProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <p className={cn("rule-label overflow-hidden text-ellipsis whitespace-nowrap py-6", className)}>
        {text}
      </p>
    );
  }

  return (
    <div className={cn("select-none", className)} aria-hidden>
      <CurvedLoopBase
        marqueeText={text}
        speed={speed}
        curveAmount={Math.min(curveAmount, 130)}
        direction={direction}
        interactive
      />
      {/* The band is decorative motion; the words are announced once here. */}
      <span className="sr-only">{text}</span>
    </div>
  );
}

/* ── Gooey nav ───────────────────────────────────────────────── */

export interface GooeyNavItem {
  label: string;
  href: string;
}

/**
 * A pill nav whose active indicator liquefies between items.
 *
 * The particle burst is pure decoration, so reduced motion drops to a plain
 * indicator by way of `particleCount: 0` — the navigation keeps working
 * identically, which is the part that matters.
 */
export function GooeyNav({
  items,
  activeIndex = 0,
  className,
}: {
  items: GooeyNavItem[];
  activeIndex?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <nav className={cn("gooey-nav-host", className)}>
      <GooeyNavBase
        items={items}
        initialActiveIndex={activeIndex}
        particleCount={reduced ? 0 : 12}
        animationTime={reduced ? 1 : 520}
        particleDistances={[70, 8]}
        particleR={80}
      />
    </nav>
  );
}

/* ── Line sidebar ────────────────────────────────────────────── */

/**
 * A ruled index whose lines bend toward the pointer.
 *
 * Used as the chapter rail beside a narrated article. Colours are passed from
 * the brand tokens rather than left on the library's purple default.
 */
export function LineIndex({
  items,
  activeIndex = null,
  onSelect,
  className,
}: {
  items: string[];
  activeIndex?: number | null;
  onSelect?: (index: number) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <LineSidebarBase
      items={items}
      className={className}
      defaultActive={activeIndex}
      onItemClick={(_: string, index: number) => onSelect?.(index)}
      accentColor="hsl(207 90% 54%)"
      textColor="hsl(220 9% 44%)"
      markerColor="hsl(214 20% 78%)"
      // Zero proximity radius means the lines simply do not move.
      proximityRadius={reduced ? 0 : 110}
      maxShift={reduced ? 0 : 22}
      smoothing={reduced ? 1 : 100}
    />
  );
}

/* ── Scroll-expanding media ──────────────────────────────────── */

/**
 * A poster that grows from an inset card to full bleed as the reader scrolls
 * into it. `enabled={false}` under reduced motion renders the media at its
 * final size immediately, so nothing is hidden behind a scroll gesture.
 */
export function ScrollExpandMedia({
  src,
  alt,
  title,
  scrollHint,
  children,
  className,
}: {
  src: string;
  alt: string;
  title?: string;
  scrollHint?: string;
  children?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <ScrollExpandBase
      src={src}
      alt={alt}
      title={title}
      scrollHint={scrollHint}
      mediaType="image"
      enabled={!reduced}
      useWindowScroll
      startWidth={54}
      startHeight={62}
      startRadius={16}
      endRadius={0}
      className={className}
    >
      {children}
    </ScrollExpandBase>
  );
}

/* ── Scroll stack ────────────────────────────────────────────── */

/**
 * Cards that stack and scale as they scroll past a pin point.
 *
 * The library drives this with its own Lenis instance. `useWindowScroll` is
 * deliberately left off so that instance is scoped to this component's own
 * scroller — a page-level Lenis would take over the document's scrolling and
 * fight both GSAP's ScrollTriggers and the voice player's follow-along.
 *
 * Under reduced motion the stack is skipped entirely and the cards render as
 * an ordinary column, because the effect *is* the scroll animation.
 */
export function ScrollStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={cn("flex flex-col gap-6", className)}>{children}</div>;
  }

  return (
    <ScrollStackBase className={className} itemDistance={90} baseScale={0.88} itemScale={0.025}>
      {children}
    </ScrollStackBase>
  );
}

export function ScrollStackItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ScrollStackItemBase itemClassName={className}>{children}</ScrollStackItemBase>;
}

/* ── Specular button ─────────────────────────────────────────── */

/**
 * A filled button with a WebGL specular highlight that tracks the pointer.
 *
 * Every instance is its own GL context, so this is reserved for a single
 * hero-level call to action rather than offered as a Button variant. Under
 * reduced motion the shimmer stops following and stays still.
 */
export function SpecularButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <SpecularButtonBase
      onClick={onClick}
      className={className}
      size="lg"
      radius={8}
      baseColor="#0E47A1"
      textColor="#ffffff"
      lineColor="#90CAF8"
      followMouse={!reduced}
      speed={reduced ? 0 : 0.3}
      intensity={reduced ? 0.4 : 1}
    >
      {children}
    </SpecularButtonBase>
  );
}

/* ── Count up ────────────────────────────────────────────────── */

/**
 * Spring-driven number count.
 *
 * The visible digits are hidden from assistive tech and the final value is
 * announced once — a screen reader should be told the number, not read a
 * hundred intermediate ones.
 */
export function SpringCountUp({
  to,
  separator = ",",
  className,
}: {
  to: number;
  separator?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <span className={className}>{to.toLocaleString()}</span>;
  }

  return (
    <span className={className}>
      <span aria-hidden>
        <CountUpBase to={to} separator={separator} duration={1.6} />
      </span>
      <span className="sr-only">{to.toLocaleString()}</span>
    </span>
  );
}
