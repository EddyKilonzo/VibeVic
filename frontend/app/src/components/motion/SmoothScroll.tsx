"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Eased document scrolling, on the public site only.
 *
 * The wheel moves a target and the page chases it over a few frames instead of
 * jumping to it. On a site whose whole entrance is a timeline and whose
 * sections arrive on ScrollTriggers, a scroll that lands instantly is the one
 * motion in the page that has no easing at all — the reader feels the
 * difference as the site being two things at once.
 *
 * ── Why this is not in AppProviders ──────────────────────────────────────
 * The newsroom is excluded deliberately. It is a tool: a writer moving through
 * a long draft, a media grid or a records list wants the scroll position they
 * asked for at the moment they asked for it, and a hundred milliseconds of
 * glide between the keypress and the paragraph is friction in the one place
 * the product is supposed to disappear. Smooth scrolling is a reading
 * pleasure, so it lives in the reading half of the app.
 *
 * ── Reduced motion is a hard stop, not a shorter duration ────────────────
 * Under `prefers-reduced-motion: reduce` Lenis is never constructed, so the
 * browser's own scrolling is untouched — no wheel interception, no rAF loop,
 * no transformed root. This is the one animation on the site where "less of
 * it" is not an acceptable answer: scroll hijacking is a common migraine and
 * vestibular trigger, and a gentler version of it is still it. The listener
 * means flipping the OS setting takes effect on the next paint rather than the
 * next reload.
 *
 * ── One raf loop, not two ────────────────────────────────────────────────
 * `autoRaf` is off and GSAP's ticker drives Lenis instead. Two independent
 * loops would step the scroll position and the tweens reading it in an
 * undefined order, which shows up as scrubbed animations lagging the page by a
 * frame and jittering. `lagSmoothing(0)` then stops GSAP from swallowing a
 * long frame: its catch-up is right for a timeline playing on its own clock
 * and wrong for a value the reader is driving with their hand.
 */
export function SmoothScroll() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    const stop = () => {
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
      tick = null;
      // Back to GSAP's default. Left at 0, a backgrounded tab would return and
      // fast-forward every timeline that ran while it was away.
      gsap.ticker.lagSmoothing(500, 33);
    };

    const start = () => {
      if (lenis) return;

      lenis = new Lenis({
        // ~0.9 of the remaining distance per frame at 60fps. Small enough to
        // read as weight, large enough that a flick still arrives promptly —
        // the failure mode of a lower value is a page that feels like it is
        // resisting the reader.
        lerp: 0.12,
        // Only the wheel. Touch scrolling is already smooth, and taking it
        // over costs the platform's own overscroll, momentum and rubber-band
        // behaviour to reimplement them worse.
        smoothWheel: true,
        syncTouch: false,
        // The browser owns `#hash` navigation, and it already honours
        // `scroll-behavior`. Lenis intercepting anchors as well is two things
        // animating one scroll position against each other.
        anchors: false,
        autoRaf: false,
      });

      // ScrollTrigger reads `window.scrollY` on the browser's scroll event,
      // which now fires behind Lenis's animated value. Without this every
      // trigger resolves against last frame's position and pinned or scrubbed
      // sections trail the content by a frame.
      lenis.on("scroll", ScrollTrigger.update);

      tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    };

    const sync = () => (query.matches ? stop() : start());

    sync();
    query.addEventListener("change", sync);

    return () => {
      query.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return null;
}
