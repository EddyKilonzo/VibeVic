"use client";

import { useEffect, useState } from "react";

/**
 * The line, in pixels from the top of the viewport, at which a section counts
 * as the one being read. It sits just below the masthead: a heading that has
 * scrolled under the header is behind the reader, not in front of them.
 */
const READING_LINE = 140;

/**
 * Which section the reader is currently in.
 *
 * ── Why an observer and not a scroll listener ────────────────────────────
 * The obvious implementation reads every heading's position on every scroll
 * event, which is a forced layout per frame on the one page where jank is
 * least acceptable. An IntersectionObserver instead fires only when a heading
 * actually crosses the reading line — a handful of times over a whole article
 * — and the callback then reads the headings once to work out which one is
 * the newest above the line.
 *
 * Reading all of them in the callback rather than trusting `entry` matters:
 * a single entry tells you one heading moved, not which one you are under,
 * and scrolling fast enough to cross two in one frame delivers them in
 * whatever order the browser chooses.
 *
 * Returns `-1` before the first heading, so a reader in the standfirst is not
 * told they are in a section they have not reached.
 */
export function useActiveSection(blockIds: string[]): number {
  const [active, setActive] = useState(-1);

  // The ids are recreated on every render by the caller's `.filter()`, so the
  // effect keys on their contents rather than on array identity.
  const key = blockIds.join("|");

  useEffect(() => {
    if (typeof window === "undefined" || blockIds.length === 0) return;

    const nodes = blockIds
      .map((id) => document.querySelector<HTMLElement>(`[data-block-id="${id}"]`))
      .filter((node): node is HTMLElement => node !== null);

    if (nodes.length === 0) return;

    const recompute = () => {
      let next = -1;
      nodes.forEach((node, index) => {
        if (node.getBoundingClientRect().top <= READING_LINE) next = index;
      });
      setActive((current) => (current === next ? current : next));
    };

    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${READING_LINE}px 0px 0px 0px`,
      threshold: [0, 1],
    });
    nodes.forEach((node) => observer.observe(node));

    // Headings can move without crossing the line — a webfont settling, the
    // reader changing text size, an image above them finishing its reveal.
    const resize = new ResizeObserver(recompute);
    resize.observe(document.documentElement);

    // Crossings are not the only way to arrive somewhere. Landing on a
    // `#section` link, restoring a scroll position, or coming back to a tab
    // that was in the background all put the reader mid-article without any
    // heading having moved across the line while anyone was watching — and a
    // hidden document does not deliver observer callbacks at all. So the
    // answer is also computed on the way in, and again on the way back.
    recompute();
    document.addEventListener("visibilitychange", recompute);

    return () => {
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}
