import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { bezier, gsapEase, seconds } from "./motion";

/**
 * GSAP setup — imported once, from `@/lib/gsap`, never from `gsap` directly.
 *
 * Centralising registration means ScrollTrigger is registered exactly once,
 * the house eases exist everywhere, and the reduced-motion contract is
 * enforced globally rather than remembered per component.
 */

let registered = false;

if (!registered) {
  gsap.registerPlugin(ScrollTrigger, useGSAP);

  // The house curves, available to every timeline by name.
  const cubic = (b: readonly number[]) => `M0,0 C${b[0]},${b[1]} ${b[2]},${b[3]} 1,1`;
  gsap.registerEase(gsapEase.ease, gsap.parseEase(cubic(bezier.ease)));
  gsap.registerEase(gsapEase.easeOut, gsap.parseEase(cubic(bezier.easeOut)));
  gsap.registerEase(gsapEase.editorial, gsap.parseEase(cubic(bezier.editorial)));

  gsap.defaults({ ease: gsapEase.editorial, duration: seconds.slow });

  // ScrollTrigger recalculates on resize anyway; ignoring mobile URL-bar
  // resizes stops a scrub from jumping as the browser chrome hides.
  ScrollTrigger.config({ ignoreMobileResize: true });

  registered = true;
}

/**
 * Runs `build` only when motion is allowed, and reverts every tween and
 * ScrollTrigger it created when the user flips the OS setting or the
 * component unmounts.
 *
 * `gsap.matchMedia` is what makes reduced-motion a hard guarantee here rather
 * than a convention: animations created inside it cannot survive the media
 * query going false.
 */
export function motionSafe(build: (ctx: gsap.Context) => void, scope?: Element | null) {
  const mm = gsap.matchMedia(scope ?? undefined);
  mm.add("(prefers-reduced-motion: no-preference)", (ctx) => build(ctx));
  return () => mm.revert();
}

/**
 * Forces a ScrollTrigger recalculation after content height changes
 * (filtering a grid, expanding the voice player, images decoding).
 */
export function refreshScrollTriggers() {
  ScrollTrigger.refresh();
}

export { gsap, ScrollTrigger, useGSAP };
