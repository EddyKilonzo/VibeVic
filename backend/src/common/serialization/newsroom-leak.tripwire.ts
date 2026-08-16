/**
 * Last line of defence on the public surface.
 *
 * The projections in `views.ts` are the actual control; this is the alarm that
 * goes off if one of them is wrong. It walks a finished public payload looking
 * for field names that only exist on newsroom records. Finding one means a view
 * is leaking, so the response is destroyed rather than sent.
 *
 * A name-based check is crude and that is fine for its job: it costs a walk of
 * an already-small payload, it cannot be defeated by forgetting to update it
 * (an unknown new field simply is not caught — the projection still is the
 * control), and it turns the most likely mistake, spreading a row into a view
 * with `...source`, into a loud failure in the first test that touches it.
 */

/** Field names that appear on newsroom records and nowhere in public content. */
const FORBIDDEN_FIELD_NAMES: readonly string[] = [
  'visibility',
  'protectedIdentity',
  'notes',
  'angle',
  'whyItMatters',
  'whatIsKnown',
  'whatIsUnknown',
  'followUps',
  'keyQuote',
  'supports',
  'interviewee',
  'speakerRole',
  'saidAt',
  'sourceId',
  'sourceIds',
  'interviewId',
  'quoteId',
  'evidenceId',
  'entityId',
  'entityIds',
  'evidenceIds',
  'accessedAt',
  'reference',
  'dueAt',
  'stage',
  'priority',
];

/** Whole collections that must never appear, mirroring PRIVATE_COLLECTIONS. */
const FORBIDDEN_COLLECTION_NAMES: readonly string[] = [
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
];

const FORBIDDEN = new Set<string>([
  ...FORBIDDEN_FIELD_NAMES,
  ...FORBIDDEN_COLLECTION_NAMES,
]);

export class NewsroomLeakError extends Error {
  constructor(readonly path: string) {
    super(
      `Public payload contains the newsroom field "${path}". The response was discarded. ` +
        `Fix the public view rather than removing this check.`,
    );
    this.name = 'NewsroomLeakError';
  }
}

/**
 * Throws on the first offending key. Depth-limited so a cyclic or absurdly
 * nested payload cannot turn the tripwire itself into the outage.
 */
export function assertNoNewsroomFields(value: unknown, path = '$', depth = 0): void {
  if (depth > 12) {
    throw new NewsroomLeakError(`${path} (payload nested deeper than the leak check inspects)`);
  }
  if (value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoNewsroomFields(item, `${path}[${index}]`, depth + 1),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new NewsroomLeakError(`${path}.${key}`);
    assertNoNewsroomFields(child, `${path}.${key}`, depth + 1);
  }
}
