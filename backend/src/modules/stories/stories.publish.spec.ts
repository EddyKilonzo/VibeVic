import { BadRequestException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { StoryStatus } from '@prisma/client';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { fakeConfig } from '../../testing/doubles';
import { StoriesService } from './stories.service';

/**
 * The publish transition.
 *
 * Three properties are worth pinning here, and they are the three the stub
 * said had to land together:
 *
 *   * The date rule — first publication sets `publishedAt`, later ones keep
 *     it. Get this wrong and every correction silently re-dates the reporting,
 *     which is a false claim about when something was known.
 *   * The canonical refusals — a placeholder, an empty body or a self-
 *     referential source URL must not reach readers, and must say why.
 *   * The un-publishing rule — status goes back, the date stays.
 *
 * No database, for the reason `testing/doubles.ts` gives: these are decisions
 * in TypeScript. The Prisma delegate is a hand-written double that records the
 * `data` it was handed, because *what was written* is exactly what is being
 * asserted.
 */

const WRITER: Principal = {
  id: 'u1',
  email: 'writer@example.com',
  scopes: ['stories:write', 'stories:publish'],
};

const DEV: Principal = {
  id: 'u2',
  email: 'dev@example.com',
  scopes: ['stories:write'],
};

interface StoryRow {
  id: string;
  slug: string;
  title: string;
  dek: string;
  body: unknown;
  placeholder: boolean;
  sourceUrl: string | null;
  status: StoryStatus;
  publishedAt: Date | null;
}

function row(over: Partial<StoryRow> = {}): StoryRow {
  return {
    id: 's1',
    slug: 'a-piece',
    title: 'A piece',
    dek: 'What it is about.',
    body: [{ type: 'paragraph', text: 'Words.' }],
    placeholder: false,
    sourceUrl: null,
    status: StoryStatus.DRAFT,
    publishedAt: null,
    ...over,
  };
}

/** The double, plus the write it last received. */
function serviceFor(story: StoryRow | null, appUrl?: string) {
  const writes: { status: StoryStatus; publishedAt?: Date }[] = [];
  const prisma = {
    story: {
      findUnique: async () => story,
      update: async ({ data }: { data: { status: StoryStatus; publishedAt?: Date } }) => {
        writes.push(data);
        return { ...story, ...data };
      },
      updateMany: async () => ({ count: 0 }),
    },
  };

  const service = new StoriesService(
    prisma as never,
    new AccessPolicyService(),
    fakeConfig(appUrl ? { APP_URL: appUrl } : {}),
  );

  /**
   * The last write, asserted rather than optional.
   *
   * Every caller of this has just awaited a publish that was supposed to
   * write. If it did not, the useful failure is "no write was made" at the
   * point of asking, not twelve `possibly undefined` complaints from the
   * compiler about assertions that would never run.
   */
  const last = () => {
    const write = writes[writes.length - 1];
    if (!write) throw new Error("No write was made.");
    return write;
  };

  return { service, writes, last };
}

describe('StoriesService.publish', () => {
  describe('the scope', () => {
    it('refuses a principal without stories:publish before anything else happens', async () => {
      const { service, writes } = serviceFor(row());
      await expect(service.publish(DEV, 's1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(writes).toHaveLength(0);
    });

    it('refuses an anonymous caller', async () => {
      const { service } = serviceFor(row());
      await expect(service.publish(undefined, 's1')).rejects.toThrow();
    });
  });

  describe('the date rule', () => {
    it('stamps a date on a piece that has never had one', async () => {
      const { service, last } = serviceFor(row());
      const before = Date.now();
      await service.publish(WRITER, 's1');
      expect(last().status).toBe(StoryStatus.PUBLISHED);
      expect(last().publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('keeps the original date when a piece is published again', async () => {
      // The correction case: a piece that ran last year, pulled and put back.
      const ran = new Date('2024-03-01T09:00:00.000Z');
      const { service, last } = serviceFor(row({ publishedAt: ran, status: StoryStatus.DRAFT }));
      await service.publish(WRITER, 's1');
      expect(last().publishedAt).toEqual(ran);
    });

    it('replaces a future date when the writer publishes now', async () => {
      // Overriding a schedule. Honouring the future date would satisfy the
      // status column and still leave the piece invisible to readers.
      const later = new Date(Date.now() + 60 * 60 * 1000);
      const { service, last } = serviceFor(row({ publishedAt: later, status: StoryStatus.SCHEDULED }));
      await service.publish(WRITER, 's1');
      expect(last().publishedAt!.getTime()).toBeLessThan(later.getTime());
    });
  });

  describe('the canonical check', () => {
    it('refuses placeholder text, and says so', async () => {
      const { service, writes } = serviceFor(row({ placeholder: true }));
      await expect(service.publish(WRITER, 's1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(writes).toHaveLength(0);
    });

    it('refuses an empty body', async () => {
      const { service } = serviceFor(row({ body: [] }));
      await expect(service.publish(WRITER, 's1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('refuses a missing standfirst', async () => {
      const { service } = serviceFor(row({ dek: '   ' }));
      await expect(service.publish(WRITER, 's1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('refuses a source URL that points back at this site', async () => {
      const { service } = serviceFor(
        row({ sourceUrl: 'https://vibevic.example/stories/a-piece' }),
        'https://vibevic.example',
      );
      await expect(service.publish(WRITER, 's1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('allows a source URL somewhere else', async () => {
      const { service, last } = serviceFor(
        row({ sourceUrl: 'https://another-paper.example/piece' }),
        'https://vibevic.example',
      );
      await service.publish(WRITER, 's1');
      expect(last().status).toBe(StoryStatus.PUBLISHED);
    });

    it('does not guess at our own origin when APP_URL is unset', async () => {
      // Without a configured origin there is nothing to compare against, and a
      // guess would refuse a legitimate syndication link.
      const { service, last } = serviceFor(row({ sourceUrl: 'https://vibevic.example/x' }));
      await service.publish(WRITER, 's1');
      expect(last().status).toBe(StoryStatus.PUBLISHED);
    });

    it('is not fooled by an origin that merely starts the same way', async () => {
      const { service, last } = serviceFor(
        row({ sourceUrl: 'https://vibevic.example.elsewhere.test/x' }),
        'https://vibevic.example',
      );
      await service.publish(WRITER, 's1');
      expect(last().status).toBe(StoryStatus.PUBLISHED);
    });
  });

  describe('scheduling', () => {
    it('takes a future instant', async () => {
      const when = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { service, last } = serviceFor(row());
      await service.publish(WRITER, 's1', { action: 'schedule', publishAt: when.toISOString() });
      expect(last().status).toBe(StoryStatus.SCHEDULED);
      expect(last().publishedAt).toEqual(when);
    });

    it('refuses a moment that has already passed', async () => {
      const { service } = serviceFor(row());
      await expect(
        service.publish(WRITER, 's1', {
          action: 'schedule',
          publishAt: new Date(Date.now() - 1000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a schedule with no date', async () => {
      const { service } = serviceFor(row());
      await expect(service.publish(WRITER, 's1', { action: 'schedule' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('holds a scheduled piece to the same canonical check as a published one', async () => {
      const { service } = serviceFor(row({ placeholder: true }));
      await expect(
        service.publish(WRITER, 's1', {
          action: 'schedule',
          publishAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('refuses a date sent with an ordinary publish rather than ignoring it', async () => {
      const { service } = serviceFor(row());
      await expect(
        service.publish(WRITER, 's1', {
          action: 'publish',
          publishAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('un-publishing', () => {
    it('moves the piece back to draft and keeps the date it ran', async () => {
      const ran = new Date('2024-03-01T09:00:00.000Z');
      const { service, last } = serviceFor(row({ status: StoryStatus.PUBLISHED, publishedAt: ran }));
      await service.publish(WRITER, 's1', { action: 'unpublish' });
      expect(last().status).toBe(StoryStatus.DRAFT);
      expect(last()).not.toHaveProperty('publishedAt');
    });

    it('cancels a schedule', async () => {
      const { service, last } = serviceFor(
        row({ status: StoryStatus.SCHEDULED, publishedAt: new Date(Date.now() + 60_000) }),
      );
      await service.publish(WRITER, 's1', { action: 'unpublish' });
      expect(last().status).toBe(StoryStatus.DRAFT);
    });

    it('refuses to take down something that is already a draft', async () => {
      const { service } = serviceFor(row({ status: StoryStatus.DRAFT }));
      await expect(service.publish(WRITER, 's1', { action: 'unpublish' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('does not run the canonical check on the way down', async () => {
      // A piece that would fail publication must still be removable — that is
      // precisely when somebody wants it gone.
      const { service, last } = serviceFor(
        row({ status: StoryStatus.PUBLISHED, placeholder: true, publishedAt: new Date() }),
      );
      await service.publish(WRITER, 's1', { action: 'unpublish' });
      expect(last().status).toBe(StoryStatus.DRAFT);
    });
  });

  it('404s on a story that is not there', async () => {
    const { service } = serviceFor(null);
    await expect(service.publish(WRITER, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
