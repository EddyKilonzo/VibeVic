/**
 * The site's own address.
 *
 * ── Why this is a single constant ────────────────────────────────────────
 * Canonical tags, Open Graph URLs, JSON-LD `mainEntityOfPage`, the sitemap
 * and the feed must all agree on one origin. When they disagree, a crawler is
 * being told the same page lives at two addresses, which is the exact
 * duplicate-content problem canonicals exist to prevent.
 *
 * It reads `NEXT_PUBLIC_SITE_URL` so the deployed origin is set once, in the
 * environment, rather than being hard-coded into a build.
 *
 * The fallback is deliberately `.example`, a reserved domain that can never
 * resolve. That is not laziness: a fallback pointing at a plausible real
 * domain would silently ship canonical tags claiming this content belongs to
 * someone else's site. A URL that obviously cannot work is a bug you notice.
 * Set the variable before deploying.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://victorkiplimo.example"
).replace(/\/$/, "");

/** An absolute URL for a path, for metadata that cannot use a relative one. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** True once a real origin has been configured. Used to gate sitemap output. */
export const SITE_URL_CONFIGURED = !SITE_URL.endsWith(".example");
