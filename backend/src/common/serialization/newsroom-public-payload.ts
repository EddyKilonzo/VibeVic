import type { PublicCollection } from './views';

/**
 * The server-side twin of `toPublicPayload` in the frontend store.
 *
 * The frontend comment is worth repeating because it is the rule: private
 * collections are dropped whole rather than filtered field by field, since an
 * allowlist of fields cannot leak a field somebody adds later, but a
 * denylist of fields absolutely can.
 *
 * Note the shape of the code. It builds the result from named keys; there is no
 * `{ ...newsroom }` anywhere, and no `delete`. A copy-then-delete version would
 * pass exactly the same tests today and start leaking the day the newsroom
 * grows a twelfth collection.
 */

/** Kept for parity with the frontend constant; used by the tests and the docs. */
export const PRIVATE_COLLECTIONS = [
  'ideas',
  'pitches',
  'sources',
  'quotes',
  'interviews',
  'entities',
  'evidence',
  'timeline',
  'notes',
  'deadlines',
] as const;

export interface NewsroomPublicPayload {
  /** Curation the journalist chose to publish. */
  collections: PublicCollection[];
  /** Per-story class, keyed by story id — also a deliberate publication. */
  portfolio: Record<string, string>;
}

export function toPublicNewsroomPayload(input: {
  collections: PublicCollection[];
  portfolio: Record<string, string>;
}): NewsroomPublicPayload {
  return {
    collections: input.collections,
    portfolio: input.portfolio,
  };
}
