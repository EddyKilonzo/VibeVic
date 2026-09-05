import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoryStatus } from '@prisma/client';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { fakeConfig } from '../../testing/doubles';
import { StoriesService } from './stories.service';

/**
 * Deleting a draft.
 *
 * One property carries the whole design and it is worth pinning on its own:
 * nothing a reader has ever been able to open can be deleted here. That is
 * what makes the missing answer to "what does the old URL say" not merely
 * deferred but absent — a draft has no old URL — so a regression that let a
 * PUBLISHED or SCHEDULED row through would not be a smaller version of this
 * feature, it would be a different one that nobody argued for.
 *
 * The second property is negative and asserted the same way: a refused delete
 * must not have touched the row. A check that throws *after* the write is
 * indistinguishable from a passing check in every test that only looks at the
 * exception.
 */

const WRITER: Principal = {
  id: 'u1',
  email: 'writer@example.com',
  scopes: ['stories:write', 'stories:publish'],
};

/** Holds `stories:write` and not `stories:publish` — the dev account's shape. */
const DEV: Principal = {
  id: 'u2',
  email: 'dev@example.com',
  scopes: ['stories:write'],
};

function serviceFor(story: { id: string; status: StoryStatus } | null) {
  const deleted: string[] = [];
  const prisma = {
    story: {
      findUnique: async () => story,
      delete: async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        return story;
      },
    },
  };

  const service = new StoriesService(
    prisma as never,
    new AccessPolicyService(),
    fakeConfig({}),
  );

  return { service, deleted };
}

describe('StoriesService.remove', () => {
  describe('the scope', () => {
    it('refuses stories:write alone, and deletes nothing', async () => {
      const { service, deleted } = serviceFor({ id: 's1', status: StoryStatus.DRAFT });
      await expect(service.remove(DEV, 's1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(deleted).toHaveLength(0);
    });

    it('refuses an anonymous caller', async () => {
      const { service, deleted } = serviceFor({ id: 's1', status: StoryStatus.DRAFT });
      await expect(service.remove(undefined, 's1')).rejects.toThrow();
      expect(deleted).toHaveLength(0);
    });
  });

  describe('what may be deleted', () => {
    it('deletes a draft', async () => {
      const { service, deleted } = serviceFor({ id: 's1', status: StoryStatus.DRAFT });
      await expect(service.remove(WRITER, 's1')).resolves.toEqual({ id: 's1', deleted: true });
      expect(deleted).toEqual(['s1']);
    });

    it('refuses a published piece and leaves it alone', async () => {
      const { service, deleted } = serviceFor({ id: 's1', status: StoryStatus.PUBLISHED });
      await expect(service.remove(WRITER, 's1')).rejects.toBeInstanceOf(BadRequestException);
      expect(deleted).toHaveLength(0);
    });

    it('refuses a scheduled piece and leaves it alone', async () => {
      // Separate from the published case because a SCHEDULED row whose moment
      // has passed is already readable — `publishedWhere` counts it in — so
      // "not yet published" is not a safe reading of the status.
      const { service, deleted } = serviceFor({ id: 's1', status: StoryStatus.SCHEDULED });
      await expect(service.remove(WRITER, 's1')).rejects.toBeInstanceOf(BadRequestException);
      expect(deleted).toHaveLength(0);
    });

    it('tells a writer which move unlocks the delete', async () => {
      // The refusal is the only place the rule is explained, so the sentence is
      // part of the feature rather than incidental wording.
      const { service } = serviceFor({ id: 's1', status: StoryStatus.PUBLISHED });
      await expect(service.remove(WRITER, 's1')).rejects.toThrow(/take it down first/i);

      const scheduled = serviceFor({ id: 's1', status: StoryStatus.SCHEDULED });
      await expect(scheduled.service.remove(WRITER, 's1')).rejects.toThrow(
        /cancel the schedule first/i,
      );
    });
  });

  it('404s on a story that is not there', async () => {
    const { service } = serviceFor(null);
    await expect(service.remove(WRITER, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
