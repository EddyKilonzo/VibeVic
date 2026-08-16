import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Optimistic concurrency, enforced in the database rather than in memory.
 *
 * The rule from the frontend store carries over unchanged: a write that carries
 * a stale `updatedAt` is refused and reported, never silently applied. The
 * reason is not tidiness. Two windows on the same interview notes, or a tab
 * left open overnight, will otherwise let a save quietly delete a paragraph
 * somebody typed ten minutes ago, and nothing in the UI will ever mention it.
 *
 * The check is a conditional UPDATE — `WHERE id = ? AND updatedAt = ?` — not a
 * read followed by a write. A read-then-write has a window between the two in
 * which another request can commit, which is exactly the race being defended
 * against; the row lock inside a single statement has no such window.
 *
 * The API requires `expectedUpdatedAt` on every update. The local store allows
 * opting out for writes that "cannot lose anything", which is a judgement a
 * client is in a position to make about its own memory and a server is not.
 */

/**
 * Delegate shape shared by every Prisma model.
 *
 * Structural, with the update payload left generic: Prisma's generated `data`
 * types are XOR unions that cannot be described by hand, so `TData` is inferred
 * from whichever delegate is passed. That keeps the helper model-agnostic
 * without an `any` — callers still get their model's own field checking, which
 * matters when the field being written is `visibility`.
 *
 * `PromiseLike`, not `Promise`, because Prisma returns its own thenable.
 */
export interface OptimisticDelegate<TRecord, TData> {
  findUnique(args: { where: { id: string } }): PromiseLike<TRecord | null>;
  updateMany(args: {
    where: { id: string; updatedAt: Date };
    data: TData;
  }): PromiseLike<{ count: number }>;
}

export interface Versioned {
  id: string;
  updatedAt: Date;
}

export function parseExpectedUpdatedAt(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      'expectedUpdatedAt must be an ISO 8601 timestamp taken from the record you loaded.',
    );
  }
  return parsed;
}

/**
 * Compare-and-swap update.
 *
 * Returns the fresh row on success. On failure the caller gets a 404 if the
 * record is gone, or a 409 carrying the *current* `updatedAt` so a client can
 * refetch and present a real conflict instead of a generic error.
 */
export async function updateWithOptimisticLock<TRecord extends Versioned, TData>(
  delegate: OptimisticDelegate<TRecord, TData>,
  id: string,
  expectedUpdatedAt: string,
  data: TData,
  notFoundMessage = 'Record not found.',
): Promise<TRecord> {
  const expected = parseExpectedUpdatedAt(expectedUpdatedAt);

  const { count } = await delegate.updateMany({
    where: { id, updatedAt: expected },
    data,
  });

  if (count === 1) {
    const updated = await delegate.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException(notFoundMessage);
    return updated;
  }

  // Zero rows matched. Either the record is gone or someone else got there
  // first; the client needs to be told which, and told what it should have had.
  const current = await delegate.findUnique({ where: { id } });
  if (!current) throw new NotFoundException(notFoundMessage);

  throw new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    message:
      'This record changed after you loaded it. Your write was not applied. Reload and reapply your edit.',
    expectedUpdatedAt: expected.toISOString(),
    currentUpdatedAt: current.updatedAt.toISOString(),
  });
}

/**
 * In-memory variant, for the rare path that already holds the row inside a
 * transaction. Only correct under a transaction or a row lock — outside one it
 * reintroduces the read-then-write window, which is why it is not the default.
 */
export function assertNotStale(current: Date, expectedUpdatedAt: string): void {
  const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
  if (current.getTime() !== expected.getTime()) {
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message: 'This record changed after you loaded it. Your write was not applied.',
      expectedUpdatedAt: expected.toISOString(),
      currentUpdatedAt: current.toISOString(),
    });
  }
}
