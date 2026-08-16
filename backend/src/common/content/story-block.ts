import { z } from 'zod';

/**
 * The block union, mirrored from frontend/app/src/data/types.ts.
 *
 * Articles are stored as ordered typed blocks rather than HTML, so the server
 * is able to validate them — and does, in both directions. Blocks arriving from
 * the editor are parsed before they are written, and blocks leaving on a public
 * response are parsed again before they are serialised: the column is `Json`,
 * so nothing but this schema stands between a hand-edited row and a reader.
 */

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('paragraph'), text: z.string() }),
  z.object({
    id: z.string(),
    type: z.literal('heading'),
    text: z.string(),
    level: z.union([z.literal(2), z.literal(3)]),
  }),
  z.object({
    id: z.string(),
    type: z.literal('quote'),
    text: z.string(),
    attribution: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('image'),
    src: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('list'),
    items: z.array(z.string()),
    ordered: z.boolean().optional(),
  }),
  z.object({ id: z.string(), type: z.literal('divider') }),
]);

export const blockArraySchema = z.array(blockSchema);

export type StoryBlock = z.infer<typeof blockSchema>;

/**
 * Strict parse for the write path: a malformed block is a rejected request, not
 * a silently dropped paragraph. Losing a sentence of someone's copy without
 * telling them is the same class of bug as overwriting it.
 */
export function parseBlocks(value: unknown): StoryBlock[] {
  return blockArraySchema.parse(value);
}

/**
 * Read path. Also strict — an unreadable body means the response is refused
 * rather than half-rendered. Callers turn this into a 500 they can see.
 */
export function parseStoredBlocks(value: unknown): StoryBlock[] {
  const parsed = blockArraySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Stored story body does not match the block schema.');
  }
  return parsed.data;
}
