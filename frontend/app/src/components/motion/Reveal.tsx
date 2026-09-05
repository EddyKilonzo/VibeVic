"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import { distance as distanceTokens, transitions, viewport } from "@/lib/motion";
import { useStaggerDelay } from "./Stagger";

export type RevealVariant =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "fade-scale"
  | "mask"
  | "mask-left";

/** Hidden states per variant. Transform + opacity + clip-path only. */
function hiddenState(variant: RevealVariant, d: number) {
  switch (variant) {
    case "fade":
      return { opacity: 0 };
    case "fade-up":
      return { opacity: 0, y: d };
    case "fade-down":
      return { opacity: 0, y: -d };
    case "fade-left":
      return { opacity: 0, x: d };
    case "fade-right":
      return { opacity: 0, x: -d };
    case "fade-scale":
      return { opacity: 0, scale: 0.97 };
    case "mask":
      return { opacity: 0, clipPath: "inset(0% 0% 100% 0%)", scale: 1.015 };
    case "mask-left":
      return { opacity: 0, clipPath: "inset(0% 100% 0% 0%)" };
  }
}

const VISIBLE = { opacity: 1, x: 0, y: 0, scale: 1, clipPath: "inset(0% 0% 0% 0%)" };

export interface RevealProps {
  children: ReactNode;
  /** Which entrance to use. */
  variant?: RevealVariant;
  /** Extra delay (ms) on top of any inherited <Stagger> delay. */
  delay?: number;
  distance?: keyof typeof distanceTokens | number;
  /** Animate on mount instead of on scroll — for page-load sequences. */
  immediate?: boolean;
  /**
   * Replay on every entry, and reverse on every exit.
   *
   * On by default — the site's reveals are tied to visibility rather than to
   * page load, so scrolling back up plays them again. Pass `false` for the
   * rare element that should settle once and stay settled.
   */
  repeat?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "li" | "span" | "header" | "figure" | "aside";
}

/**
 * Whether reveals in this part of the app replay, and how far they travel.
 *
 * ── Why this is a context and not a prop at every call site ──────────────
 * `repeat` defaults to true because the reading side wants it: the site's
 * reveals are tied to visibility rather than to page load, so scrolling back
 * up an article plays them again and that is the intended editorial feel.
 *
 * The newsroom is not the reading side. It is a tool with fifty-eight of
 * these in it, and there every panel fading in on the way down and back out
 * on the way up is not atmosphere — it is the interface moving while somebody
 * is trying to work in it. A writer scrolling between a paragraph and the
 * source record behind it should find the source record simply there.
 *
 * Setting `repeat={false}` at fifty-eight call sites would fix today and
 * nothing after it: the fix would be a convention, and the next panel added
 * would be the one that forgot. A context makes it a property of the region,
 * so a component dropped into the newsroom inherits the newsroom's answer
 * without knowing it is in one.
 *
 * An explicit prop still wins, for the rare element that genuinely wants the
 * other behaviour.
 */
interface RevealDefaults {
  repeat: boolean;
  /** The travel of the entrance. Shorter where the content is dense. */
  distance: keyof typeof distanceTokens;
}

const RevealContext = createContext<RevealDefaults>({ repeat: true, distance: "md" });

export function RevealDefaults({
  repeat,
  distance,
  children,
}: RevealDefaults & { children: ReactNode }) {
  return (
    <RevealContext.Provider value={{ repeat, distance }}>{children}</RevealContext.Provider>
  );
}

/**
 * The single scroll-reveal primitive, built on Motion's `whileInView`.
 *
 * Everything that enters on scroll — a heading, a card, an image, a timeline
 * row — goes through this component, so one change to the curve changes the
 * whole site. Motion handles the observer, so there is no scroll listener
 * anywhere on the reveal path.
 *
 * Under reduced motion it renders a plain element: no variants, no observer,
 * content visible immediately.
 */
export function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  distance,
  immediate = false,
  repeat,
  className,
  style,
  as = "div",
}: RevealProps) {
  const reduced = useReducedMotion();
  const inherited = useStaggerDelay();
  // The call site wins; the region answers when it has not said.
  const defaults = useContext(RevealContext);
  const travel = distance ?? defaults.distance;
  const replay = repeat ?? defaults.repeat;
  const px = typeof travel === "number" ? travel : distanceTokens[travel];

  const Tag = motion[as];

  /**
   * The mount kick, and the reason nothing needs a refresh to appear.
   *
   * `whileInView` sets its observer up when the element mounts, and on a
   * client-side navigation that happens *before* the router has scrolled the
   * new page to the top. The observer's first reading is therefore taken at
   * the old scroll offset: an element that is about to be on screen measures
   * as off screen. Nothing further fires, because nothing further *changes* —
   * an observer reports transitions, and if the reader is already looking at
   * the element and does not scroll, there is no transition to report. The
   * section sits at opacity zero until something forces a re-render.
   *
   * So the element is measured directly, two frames after mount: one frame for
   * layout, the second to land after the router's scroll. If it is on screen
   * by then it is shown, whatever the observer concluded.
   *
   * ── And then it lets go ──────────────────────────────────────────────
   * `animate` outranks `whileInView` in Motion, so leaving this set would pin
   * every element visible forever and kill the replay behaviour entirely. It
   * is cleared on the next tick, by which point the observer has live and
   * correct readings and owns the element again. If the element is still in
   * view, `whileInView` simply holds it where it is and nothing flickers.
   *
   * This runs from a ref callback rather than an effect. Effects are for
   * synchronising with external systems; this is a one-shot measurement of the
   * node React has just handed over.
   */
  const [kicked, setKicked] = useState(false);

  const check = useCallback((node: HTMLElement | null) => {
    if (!node || typeof window === "undefined") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const box = node.getBoundingClientRect();
        // Any part of it inside the window counts. The editorial trigger line
        // is the observer's job; this is only here to stop things vanishing.
        if (box.top >= window.innerHeight || box.bottom <= 0) return;

        setKicked(true);
        window.setTimeout(() => setKicked(false), 120);
      });
    });
  }, []);

  if (reduced) {
    const Plain = as;
    return (
      <Plain className={className} style={style}>
        {children}
      </Plain>
    );
  }

  const variants: Variants = {
    hidden: {
      ...hiddenState(variant, px),
      // Exits are quicker than entrances and carry no stagger delay. Mirroring
      // the entrance exactly — 620ms, staggered — means a grid you scroll past
      // spends half a second visibly dismantling itself behind you, which is
      // the version of replay that reads as noise. Leaving should be something
      // you only notice if you look back.
      transition: { ...transitions.normal, delay: 0 },
    },
    visible: {
      ...VISIBLE,
      transition: { ...transitions.editorial, delay: (inherited + delay) / 1000 },
    },
  };

  const trigger = immediate
    ? { animate: "visible" as const }
    : {
        // `animate` outranks `whileInView`, so the mount kick can force the
        // visible state without racing the observer — and is cleared again
        // straight afterwards so the observer keeps ownership. See above.
        animate: kicked ? ("visible" as const) : undefined,
        whileInView: "visible" as const,
        viewport: { once: !replay, margin: viewport.margin, amount: viewport.amount },
      };

  return (
    <Tag
      ref={immediate ? undefined : check}
      className={cn(className)}
      style={style}
      initial="hidden"
      variants={variants}
      {...trigger}
    >
      {children}
    </Tag>
  );
}

/* ── Named shorthands ─────────────────────────────────────────────
   Same primitive, read more clearly at the call site.              */

export const FadeIn = (p: Omit<RevealProps, "variant">) => <Reveal {...p} variant="fade" />;
export const FadeUp = (p: Omit<RevealProps, "variant">) => <Reveal {...p} variant="fade-up" />;
export const FadeInScale = (p: Omit<RevealProps, "variant">) => (
  <Reveal {...p} variant="fade-scale" />
);
