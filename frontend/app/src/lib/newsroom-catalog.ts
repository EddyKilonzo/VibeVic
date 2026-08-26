/**
 * The catalog surface: awards and beats.
 *
 * ── Why these are not `records` ──────────────────────────────────────────
 * `newsroom-records.ts` fronts the eleven private collections. These two are
 * published content — an award is a credential the site states out loud, a beat
 * is the taxonomy every story is filed against — so they sit behind
 * `stories:write` rather than the newsroom scopes, and neither carries a
 * `visibility` to translate. Sharing that proxy would mean one allowlist
 * covering two different authorisation stories, which is exactly the kind of
 * convenience that turns into a hole.
 *
 * ── An allowlist, again, and for the same reason ─────────────────────────
 * Two names cost two lines and make the reachable surface something you can
 * read rather than reason about. An unknown segment is a 404 at the proxy
 * rather than a request forwarded to see what the API makes of it.
 */

export const CATALOG_KINDS = ["awards", "genres"] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}

/**
 * What each kind is keyed by.
 *
 * Awards have a cuid; beats are keyed by their slug, because that is the
 * primary key of the table and the foreign key every story carries. The proxy
 * has to know the difference only to build the path — the API's own routes are
 * `:id` and `:slug` respectively, and neither accepts the other.
 */
export const CATALOG_KEY: Record<CatalogKind, "id" | "slug"> = {
  awards: "id",
  genres: "slug",
};
