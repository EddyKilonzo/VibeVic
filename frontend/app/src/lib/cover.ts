/**
 * Deterministic cover art.
 *
 * The site ships without a media pipeline, so covers are generated as inline
 * SVG data-URIs seeded from the story slug: the same story always gets the
 * same image, they stay on-brand, and there are no network requests or
 * missing-asset gaps to design around. Swapping in real uploads later means
 * replacing `Story.cover` with a URL — nothing else changes.
 */

const PALETTES: Array<[string, string, string]> = [
  ["#0E47A1", "#2196F3", "#E4F2FD"],
  ["#123A6B", "#90CAF8", "#F4F9FE"],
  ["#0B2C58", "#2196F3", "#C9E4FB"],
  ["#1B4FA8", "#63AEF3", "#EAF4FE"],
  ["#0E47A1", "#7EC0F7", "#FFFFFF"],
  ["#15325C", "#4FA3EE", "#DCEEFC"],
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A small seeded PRNG so a cover's shapes are stable across reloads. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function coverFor(slug: string, width = 1200, height = 750): string {
  const h = hash(slug);
  const [deep, mid, light] = PALETTES[h % PALETTES.length];
  const rand = rng(h);
  const angle = Math.floor(rand() * 90);

  const shapes: string[] = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rand() * width);
    const cy = Math.floor(rand() * height);
    const r = Math.floor(height * (0.22 + rand() * 0.45));
    const fill = i % 2 === 0 ? light : mid;
    shapes.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${(0.1 + rand() * 0.22).toFixed(2)}"/>`,
    );
  }
  // A couple of editorial rules to break up the field.
  const ruleY = Math.floor(height * (0.3 + rand() * 0.4));
  shapes.push(
    `<rect x="0" y="${ruleY}" width="${width}" height="1.5" fill="${light}" opacity="0.28"/>`,
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="g" gradientTransform="rotate(${angle})">
<stop offset="0%" stop-color="${deep}"/>
<stop offset="60%" stop-color="${mid}"/>
<stop offset="100%" stop-color="${deep}"/>
</linearGradient>
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/>
${shapes.join("")}
<rect width="100%" height="100%" filter="url(#n)" opacity="0.07"/>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ""))}`;
}

/** Square variant for avatars and list thumbnails. */
export function thumbFor(slug: string): string {
  return coverFor(slug, 400, 400);
}
