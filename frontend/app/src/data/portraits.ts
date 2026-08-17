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

const frame = (
  src: string,
  alt: string,
  caption: string,
  width = 1080,
  height = 1440,
): Portrait => ({
  src: `/images/${src}`,
  alt,
  caption,
  width,
  height,
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

/* ── On assignment ────────────────────────────────────────────────────────
 * Colour, and shot by someone else — these are him at work rather than him
 * posed, which is why they live apart from the black-and-white set.
 *
 * The filenames these arrived under carried the name "Melwin Kiprop". That is
 * either the photographer or the second person in the frame, and nobody has
 * said which, so it is recorded here and *not* published as a credit. Guessing
 * an attribution is the one thing a journalist's site cannot do casually.
 * Confirm it and add a `credit` field.
 */

/** Suited, camera and flash in hand, outside a campus building. */
export const ON_ASSIGNMENT = frame(
  "victor-kiplimo-on-assignment.jpg",
  "Victor Kiplimo in a navy suit holding a Canon camera with a flash mounted",
  "On assignment",
  1170,
  1462,
);

/** Two photographers reviewing what they have just shot. */
export const REVIEWING_FRAMES = frame(
  "victor-kiplimo-reviewing-frames.jpg",
  "Victor Kiplimo and another photographer looking at the back of a camera together",
  "Checking the take",
  1170,
  1462,
);

/**
 * A self-shot vertical clip.
 *
 * Served from this site rather than embedded, so it costs no third-party
 * request and nothing is contacted before the viewer presses play. It has
 * sound, which is exactly why it never autoplays.
 */
export const FIELD_CLIP = {
  src: "/video/day-in-the-life.mp4",
  title: "A day in the life",
  caption: "Filmed and cut by him, between assignments.",
} as const;

/**
 * The About page's gallery band.
 *
 * Three, and `AGAINST_WALL` is absent because it is that page's hero. Each of
 * the four then appears exactly once on the page. A picture repeating on a
 * single screen reads as a shortage of pictures rather than as a choice, and
 * there is no shortage.
 */
export const GALLERY: Portrait[] = [PORTRAIT, WITH_CAMERA, SHOOTING];

/**
 * The About page's picture wall.
 *
 * All four of the black-and-white set. `AGAINST_WALL` also stands in for the
 * press pass on devices that cannot show it, and appearing in both is fine —
 * the two are never on screen together.
 */
export const WALL: Portrait[] = [PORTRAIT, WITH_CAMERA, SHOOTING, AGAINST_WALL];
