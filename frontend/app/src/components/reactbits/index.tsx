"use client";

import { Children, useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";

// The React Bits sources are untyped JSX. Everything above this file imports
// from here instead, so the product only ever sees typed props — and so the
// reduced-motion and touch guards below cannot be forgotten at a call site.
/* eslint-disable @typescript-eslint/no-explicit-any */
import RbCurvedLoop from "./CurvedLoop.jsx";
import RbLineSidebar from "./LineSidebar.jsx";
import RbScrollExpand from "./ScrollExpand.jsx";
import RbSpecularButton from "./SpecularButton.jsx";
import RbCountUp from "./RbCountUp.jsx";

const CurvedLoopBase = RbCurvedLoop as any;
const LineSidebarBase = RbLineSidebar as any;
const ScrollExpandBase = RbScrollExpand as any;
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
 * The band paints in `currentColor`, so the section around it sets the
 * colour. `curveAmount` is capped: the viewBox is 120 units tall and the
 * midpoint of the arc sits at 40 + curveAmount/2, so past about 140 the text
 * leaves the box and the band renders blank. See `CurvedLoop.css` for the
 * matching constraint on font size.
 */
export function CurvedMarquee({
  text,
  speed = 1.4,
  curveAmount = 70,
  direction = "left",
  className,
}: CurvedMarqueeProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <p
        className={cn(
          "font-display overflow-hidden text-ellipsis whitespace-nowrap py-4 text-center text-2xl font-semibold tracking-tight sm:text-4xl",
          className,
        )}
      >
        {text.replace(/\s*·\s*$/, "")}
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
      <span className="sr-only">{text.replace(/\s*·\s*$/, "")}</span>
    </div>
  );
}

/* ── Pill nav ────────────────────────────────────────────────── */

export interface PillNavItem {
  label: string;
  href: string;
}

/**
 * A jump nav whose active pill flows to whichever item you pick.
 *
 * ── Why this is not React Bits' GooeyNav ─────────────────────────────────
 * That component draws its indicator as a metaball: a white rectangle and a
 * white pill, blurred, pushed through `contrast(100)` to threshold them into a
 * single blob, then composited with `mix-blend-mode: lighten` so the black
 * backdrop drops out. It is a lovely trick and it only holds together inside
 * the exact compositing environment it was written for. Dropped into this
 * page it leaked, twice and differently: first a purple bloom over the pale
 * hero panel, then — once the surface was made dark enough for the blend to
 * work — the 150px black backdrop rectangle showing through beside the rail,
 * with the label doubled because the effect layer carries its own copy of the
 * active item's text and positions it independently.
 *
 * A shared `layoutId` does the same job — one pill, moving between items —
 * with no blend modes, no filters and no second copy of the text. It is one
 * element, it inherits the palette, and it cannot go wrong against a
 * background it was not designed for. Under reduced motion the pill jumps
 * instead of sliding; the navigation is identical either way.
 */
export function PillNav({
  items,
  activeIndex = 0,
  className,
}: {
  items: PillNavItem[];
  activeIndex?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(activeIndex);
  const layout = useId();

  return (
    <nav
      aria-label="Jump to a beat"
      className={cn(
        "inline-flex max-w-full rounded-full bg-sidebar p-1.5 shadow-lifted",
        className,
      )}
    >
      <ul className="flex flex-wrap items-center justify-center gap-0.5">
        {items.map((item, i) => {
          const current = i === active;

          return (
            <li key={item.href} className="relative">
              <a
                href={item.href}
                onClick={() => setActive(i)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "focus-ring tap relative inline-flex items-center rounded-full px-4 text-[13px] font-semibold transition-colors duration-normal",
                  current ? "text-primary" : "text-white/70 hover:text-white",
                )}
              >
                {current && (
                  <motion.span
                    aria-hidden
                    layoutId={`pill-${layout}`}
                    className="absolute inset-0 rounded-full bg-white shadow-raised"
                    transition={reduced ? { duration: 0 } : transitions.sheet}
                  />
                )}
                <span className="relative">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
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
 * Cards that pin and stack as the next one scrolls over them.
 *
 * ── Why this is `position: sticky` and not the library component ─────────
 * React Bits' ScrollStack pins by putting the cards inside its *own* scroll
 * container (`overflow-y: auto; overscroll-behavior: contain`) and driving it
 * with a scoped Lenis instance. That works in isolation and is wrong on a
 * page: while the pointer is anywhere over the stack, the wheel scrolls the
 * inner box instead of the document, and `overscroll-behavior: contain` stops
 * the scroll from ever chaining back out. On `/genres` that read exactly as
 * the page freezing part way down. Its stylesheet also forced every card to
 * `height: 20rem; padding: 3rem; border-radius: 40px`, which is why the cards
 * ignored the padding and radius they were given.
 *
 * Sticky positioning gives the same effect with none of that: the page keeps
 * one scroller, each card parks under the header at a slightly lower offset
 * than the one before it, and the next card slides over the top. It needs no
 * JavaScript, no scroll listener and no smooth-scroll library, so it cannot
 * fight GSAP's ScrollTriggers or the voice player's follow-along either.
 *
 * The cards must be opaque for the overlap to read — every call site passes
 * `surface`, which is.
 */
export function ScrollStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const items = Children.toArray(children);
  const last = items.length - 1;

  return (
    <div className={cn("relative", className)}>
      {items.map((child, i) => (
        <div
          key={i}
          className="sticky"
          style={{
            // 5.5rem clears the masthead; each card then parks 14px lower than
            // the one under it, so a stack of four fans rather than hiding.
            top: `calc(5.5rem + ${i * 14}px)`,
            zIndex: i + 1,
            // The gap is padding rather than margin so it belongs to the
            // sticky box and does not collapse against the next card. It has
            // to be generous: the gap is the distance the reader scrolls
            // between one card parking and the next arriving, and too small a
            // value makes every card stick at once and simply pile up.
            paddingBottom: i === last ? 0 : "5rem",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export function ScrollStackItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
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
