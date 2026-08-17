/**
 * Photographs of Victor.
 *
 * ── Why these are a separate module from `imagery.ts` ────────────────────
 * `imagery.ts` holds stock, and its rule is that stock is atmosphere and never
 * evidence. These are the opposite case: real photographs of the person whose
 * site this is, supplied by him. They may sit beside his name, his byline and
 * his biography, because that is exactly what they depict.
 *
 * What they still may **not** do is stand in as reporting. None of these is a
 * frame from a story, so none of them may be used as a story or report cover,
 * or captioned as though it were shot on an assignment. The captions below
 * describe only what is in the frame — no place, no date, no event — because
 * nobody told us any of those things and a journalist's site is the last place
 * to start guessing.
 *
 * All four are 1080×1440 (3:4), black and white, from the same set.
 */

export interface Portrait {
  src: string;
  /** Describes what is visible, and nothing more. */
  alt: string;
  /** Short display line. Optional — most placements do not caption. */
  caption: string;
  width: number;
  height: number;
}

const frame = (src: string, alt: string, caption: string): Portrait => ({
  src: `/images/${src}`,
  alt,
  caption,
  width: 1080,
  height: 1440,
});

/** Head-and-shoulders, looking to camera. The one to use where a face is wanted. */
export const PORTRAIT = frame(
  "victor-kiplimo-portrait.webp",
  "Victor Kiplimo in a flat cap and overcoat, turned to the camera",
  "Portrait",
);

/** Holding the camera at chest height, looking off-frame. */
export const WITH_CAMERA = frame(
  "victor-kiplimo-camera.webp",
  "Victor Kiplimo holding a Canon SLR at chest height, looking off-frame",
  "The kit — he shoots his own pieces",
);

/** Mid-frame, camera raised. Reads as working rather than posing. */
export const SHOOTING = frame(
  "victor-kiplimo-shooting.webp",
  "Victor Kiplimo standing outdoors with a Canon SLR raised to his eye",
  "Shooting",
);

/** Full length against a stone wall — the widest of the four. */
export const AGAINST_WALL = frame(
  "victor-kiplimo-wall.webp",
  "Victor Kiplimo leaning against a stone wall in sunglasses and an overcoat",
  "On location",
);

/**
 * The About page's gallery band.
 *
 * Two, not four. That page now shows `AGAINST_WALL` in its hero and
 * `SHOOTING` beside the biography, so these are the ones left — which works
 * out at each of the four appearing exactly once on the page. A picture
 * repeating on a single screen reads as a shortage of pictures rather than as
 * a choice, and there is no shortage.
 */
export const GALLERY: Portrait[] = [PORTRAIT, WITH_CAMERA];
