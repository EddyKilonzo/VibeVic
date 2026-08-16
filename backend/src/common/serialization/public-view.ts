/**
 * Public views: the only way data becomes a public response.
 *
 * A view is a named projection from a database row to an explicitly listed
 * output shape. It is written as a construction, never as a deletion — the
 * projection builds a fresh object out of named fields rather than copying the
 * row and removing the sensitive ones. That difference is the whole point: a
 * column added to `Source` next month is invisible to a projection, but a
 * deletion-based sanitiser would start publishing it the day it is added.
 *
 * The same reasoning as `toPublicPayload` in the frontend store, which drops
 * private collections whole rather than filtering them field by field.
 */

export interface PublicView<TIn, TOut> {
  /** Used in error messages when a route's declared view does not match. */
  readonly name: string;
  project(input: TIn): TOut;
}

export function definePublicView<TIn, TOut>(
  name: string,
  project: (input: TIn) => TOut,
): PublicView<TIn, TOut> {
  return { name, project };
}

export function isPublicView(value: unknown): value is PublicView<unknown, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PublicView<unknown, unknown>).name === 'string' &&
    typeof (value as PublicView<unknown, unknown>).project === 'function'
  );
}

/**
 * Applies a view to whatever the controller returned.
 *
 * Handles a single record, a list, and `null` (a 404-ish empty read). Anything
 * else — a paginated envelope, say — must be given its own view rather than
 * being special-cased here, because every shape this function learns to unwrap
 * is a shape that gets past the projection unprojected.
 */
export function applyPublicView<TIn, TOut>(
  view: PublicView<TIn, TOut>,
  value: unknown,
): TOut | TOut[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => view.project(item as TIn));
  return view.project(value as TIn);
}

/** ISO strings on the wire; the frontend model reads dates as ISO text. */
export function iso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function isoRequired(value: Date): string {
  return value.toISOString();
}
