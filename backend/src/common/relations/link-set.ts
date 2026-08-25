import { NotFoundException } from '@nestjs/common';

/**
 * Join-table reconciliation, and the reason it is a diff rather than a rewrite.
 *
 * Six newsroom records carry lists of ids — a quote belongs to stories, a piece
 * of evidence names entities, a timeline event points at both. The client sends
 * the list it wants; the database holds the list it has. Turning one into the
 * other by deleting every row and re-inserting would work, and would also
 * destroy the `createdAt` on every link that did not change. That column is not
 * decoration here: `story_sources` records that a story talked to a source, and
 * when. Rewriting the set every time a caller edits an unrelated field would
 * reset that history to the moment of the edit.
 *
 * So the helper computes what actually changed, and the caller runs two narrow
 * statements with its own model's generated types. Deliberately not a generic
 * that takes the Prisma delegate: the composite-key `where` clauses differ per
 * table, and describing them structurally would need the `any` this codebase
 * has already been through the trouble of removing.
 */

export interface LinkDiff {
  /** Ids present in the requested set and absent from the stored one. */
  add: string[];
  /** Ids stored now and not requested. */
  remove: string[];
}

/**
 * What to insert and what to delete to turn `current` into `next`.
 *
 * Duplicates in `next` collapse — the join tables have composite primary keys,
 * so a repeated id is not a second link and inserting it twice is an error
 * rather than a no-op. Order is not preserved because these sets are unordered;
 * the one place order is data, `CollectionStory.position`, is written
 * explicitly and does not use this.
 */
export function linkDiff(current: readonly string[], next: readonly string[]): LinkDiff {
  const held = new Set(current);
  const wanted = new Set(next);

  return {
    add: [...wanted].filter((id) => !held.has(id)),
    remove: [...held].filter((id) => !wanted.has(id)),
  };
}

/**
 * The same diff, for a set the caller can only partly see.
 *
 * Three newsroom joins point at tiered tables — pitches at sources, evidence
 * and timeline events at entities. A principal without `newsroom:confidential`
 * is shown those links filtered, so the list they send back describes a subset
 * of what is stored. Diffing it against the full stored set would read every
 * hidden link as "removed" and quietly cut a confidential record loose: a
 * destructive edit made by someone who was never shown what they were editing,
 * and one that leaves no trace of what it detached.
 *
 * So the hidden ids are held out of the comparison entirely. What the caller
 * cannot see, they cannot delete by omission. The cost is that there is no way
 * for such a caller to remove a hidden link at all, which is the right trade:
 * the fix for a wrong confidential link is to open it with the scope that can
 * see it, not to guess.
 */
export function linkDiffPreservingHidden(
  stored: readonly string[],
  requested: readonly string[],
  visible: ReadonlySet<string>,
): LinkDiff {
  return linkDiff(stored.filter((id) => visible.has(id)), requested);
}

/**
 * Pulls one column out of a set of join rows.
 *
 * Join reads come back as `[{ storyId: "..." }]` and every service wants
 * `["..."]`. Typed against the key so a rename of the column is a compile
 * error at the call site instead of an array of `undefined` on the wire.
 */
export function ids<K extends string>(
  rows: readonly Record<K, string>[],
  key: K,
): string[] {
  return rows.map((row) => row[key]);
}

/**
 * The minimum a delegate must offer to be checked for existence. Structural
 * rather than a Prisma type, so one function serves `story`, `entity` and
 * `evidenceItem` without either an import cycle or a cast.
 */
export interface ExistenceDelegate {
  findMany(args: {
    where: { id: { in: string[] } };
    select: { id: true };
  }): PromiseLike<{ id: string }[]>;
}

/**
 * Refuses the write unless every requested id exists.
 *
 * Without this the failure arrives as a foreign-key violation from the driver:
 * a 500 with a constraint name in it, which tells a journalist nothing and
 * sends a developer to the wrong file. The check costs one indexed query and
 * turns the same mistake into a 404 that names the ids that were wrong.
 *
 * It deliberately does not consider visibility. The tables this guards —
 * stories, entities, evidence — have no confidential tier, so "does it exist"
 * is the whole question. Sources do have one, and are checked separately by
 * PitchesService against the access policy instead, because there the honest
 * answer to a hidden id is that it does not exist.
 */
export async function assertAllExist(
  delegate: ExistenceDelegate,
  requested: readonly string[],
  describe: (missing: string[]) => string,
): Promise<string[]> {
  const unique = [...new Set(requested)];
  if (unique.length === 0) return [];

  const found = await delegate.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const present = new Set(found.map((row) => row.id));
  const missing = unique.filter((id) => !present.has(id));
  if (missing.length > 0) throw new NotFoundException(describe(missing));

  return unique;
}
