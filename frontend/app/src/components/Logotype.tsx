import { cn } from "@/lib/utils";

/**
 * The mark, and the name beside it.
 *
 * ── Where the shape comes from ───────────────────────────────────────────
 * Not invented. The site already runs a honeycomb through every page —
 * `--comb-ink`, the `.honeycomb` surfaces, the cell in `icon.svg` — so a mark
 * that ignored it would be a second identity competing with the one already
 * on screen. This is one cell of that comb.
 *
 * Inside it, the four segments that descend from the upper corners to the
 * bottom point are drawn heavy: those edges are already a V, so the monogram
 * is not placed *in* the hexagon, it is the part of the hexagon that was
 * always a V. The rest of the cell stays as a light ring around it.
 *
 * That is the whole idea, and it is why it survives being shrunk. There is
 * one shape, not two overlaid — at 16px the ring drops away and the V is
 * still the same strokes it was at 180px.
 *
 * ── Why it is geometry and not type ──────────────────────────────────────
 * The same reason `icon.svg` gives: a mark set in a font is a different mark
 * on a machine that does not have the font, and a monogram that falls back to
 * Times is not a monogram. Every point below is computed from one hexagon.
 *
 * ── Why the heavy strokes are `currentColor` ─────────────────────────────
 * The mark sits on three grounds — the frosted white header, the navy admin
 * sidebar, and the footer — and inheriting means it is legible on all three
 * without a variant per placement. The ring carries its own opacity rather
 * than its own colour, so it follows wherever the V goes.
 */

/*
 * A pointy-top hexagon on a 32-unit box, centre (16,16), radius 12.
 *
 * Vertices at 30° intervals starting at the top point. Written out rather than
 * generated so the file can be read without running it, and so a designer
 * nudging a point does not have to reason about trigonometry to do it.
 */
const TOP: [number, number] = [16, 4];
const UPPER_RIGHT: [number, number] = [26.39, 10];
const LOWER_RIGHT: [number, number] = [26.39, 22];
const BOTTOM: [number, number] = [16, 28];
const LOWER_LEFT: [number, number] = [5.61, 22];
const UPPER_LEFT: [number, number] = [5.61, 10];

const point = ([x, y]: [number, number]) => `${x} ${y}`;

/** The whole cell. */
const CELL = `M ${point(TOP)} L ${point(UPPER_RIGHT)} L ${point(LOWER_RIGHT)} L ${point(
  BOTTOM,
)} L ${point(LOWER_LEFT)} L ${point(UPPER_LEFT)} Z`;

/** The four edges that were already a V. */
const VEE = `M ${point(UPPER_LEFT)} L ${point(LOWER_LEFT)} L ${point(BOTTOM)} L ${point(
  LOWER_RIGHT,
)} L ${point(UPPER_RIGHT)}`;

export function LogoMark({
  className,
  size = 28,
  /**
   * Drops the surrounding ring.
   *
   * For the smallest placements, where the ring and the V are two strokes
   * three pixels apart and the eye resolves them as one thick smudge. The V
   * alone is still the mark.
   */
  bare = false,
}: {
  className?: string;
  size?: number;
  bare?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      // Decorative wherever it appears: every placement puts the name in text
      // next to it, and a screen reader announcing "Victor Kiplimo" twice is
      // worse than not announcing the picture of it at all.
      aria-hidden
      focusable="false"
    >
      {!bare && (
        <path
          d={CELL}
          stroke="currentColor"
          strokeOpacity={0.24}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
      <path
        d={VEE}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The mark with the name, which is the form most placements want.
 *
 * ── Why the name is still type and not part of the SVG ───────────────────
 * Because it is a name, and names are text: it is selectable, it is
 * searchable, it reflows, it is read correctly by a screen reader, and it
 * inherits the display face the rest of the site sets. A wordmark converted
 * to outlines buys pixel-identical letterforms and gives up all of that,
 * which is the wrong trade for a byline.
 */
export function Logotype({
  className,
  size = 28,
  /** The line under the name. Omitted where the context already says it. */
  strapline,
}: {
  className?: string;
  size?: number;
  strapline?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold leading-none tracking-tight">
          Victor Kiplimo
        </span>
        {strapline && (
          <span className="mt-1 block font-sans text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-muted-foreground">
            {strapline}
          </span>
        )}
      </span>
    </span>
  );
}
