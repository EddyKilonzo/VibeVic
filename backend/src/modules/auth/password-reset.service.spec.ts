import { createHash } from 'node:crypto';
import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { fakeConfig, withClock } from '../../testing/doubles';
import { PasswordResetService } from './password-reset.service';
import type { PasswordService } from './password.service';

/**
 * The reset flow, against the four rules the service says it is built on.
 *
 * ── Rule 1: the answer never depends on whether the address exists ───────
 * Both the known and the unknown path have to resolve to the same nothing.
 * The 503 for an unconfigured mailer is the one visible failure, so it is
 * raised before any lookup — there is a test for that ordering, because a
 * later edit that moves the check below the query turns the one permitted
 * exception into an enumeration oracle without changing a single message.
 *
 * ── Rule 2: the token is never stored ────────────────────────────────────
 * What goes in the row is a SHA-256. The test pulls the raw token back out of
 * the email that was sent, hashes it, and asserts that is what was written —
 * which checks the two halves agree as well as that the plaintext is absent.
 *
 * ── Rules 3 and 4: one live link, and spending it ends every session ─────
 * Asking again cancels the last link; spending one moves `tokensValidFrom`
 * in the same transaction as the new hash. That last part is the reason a
 * reset is the answer to "someone else may have my password", and it is one
 * array element away from silently not happening.
 */

beforeAll(() => Logger.overrideLogger(false));

const NOW = Date.parse('2026-06-01T12:00:00.000Z');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

interface ResetRow {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

function build(options: {
  mailConfigured?: boolean;
  user?: { id: string; email: string; name: string } | null;
  reset?: ResetRow | null;
  appUrl?: string;
  ttlMinutes?: number;
} = {}) {
  const userFindUnique = jest.fn().mockResolvedValue(
    options.user === undefined
      ? { id: 'user_1', email: 'vic@example.com', name: 'Victor' }
      : options.user,
  );

  const resetFindUnique = jest.fn().mockResolvedValue(options.reset ?? null);
  const create = jest.fn().mockResolvedValue({ id: 'reset_1' });
  const update = jest.fn().mockResolvedValue(undefined);
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const deleteOne = jest.fn().mockResolvedValue(undefined);

  const prisma = {
    user: { findUnique: userFindUnique, update: jest.fn().mockResolvedValue(undefined) },
    passwordReset: {
      findUnique: resetFindUnique,
      create,
      update,
      deleteMany,
      delete: deleteOne,
    },
    // Both shapes the service uses: a callback for the issue path, an array
    // for the spend path. The callback is handed the same object, which is
    // as true as a fake can be — the real `tx` is a client scoped to the
    // transaction, and nothing here is testing the isolation itself.
    $transaction: jest.fn((argument: unknown) => {
      if (Array.isArray(argument)) return Promise.all(argument as unknown[]);
      return (argument as (tx: unknown) => Promise<unknown>)(prisma);
    }),
  } as unknown as PrismaService & { user: { update: jest.Mock } };

  const send = jest.fn().mockResolvedValue(undefined);
  const mail = {
    get configured() {
      return options.mailConfigured ?? true;
    },
    send,
  } as unknown as MailService;

  const hash = jest.fn().mockResolvedValue('$argon2id$new-hash');
  const passwords = { hash } as unknown as PasswordService;

  const service = new PasswordResetService(
    fakeConfig({
      PASSWORD_RESET_TTL_MINUTES: options.ttlMinutes ?? 30,
      APP_URL: options.appUrl ?? 'https://vibevic.example',
    }),
    prisma,
    mail,
    passwords,
  );

  return {
    service,
    prisma,
    userFindUnique,
    resetFindUnique,
    create,
    update,
    deleteMany,
    deleteOne,
    send,
    hash,
  };
}

/** The `Message` the service handed to the mailer, or a failed assertion. */
function sentMessage(send: jest.Mock): { to: string; subject: string; text: string } {
  expect(send).toHaveBeenCalledTimes(1);
  const [message] = send.mock.calls[0] as [{ to: string; subject: string; text: string }];
  return message;
}

/** The reset URL out of the email body, which is where the raw token lives. */
function linkFrom(send: jest.Mock): URL {
  const match = /https?:\/\/\S+/.exec(sentMessage(send).text);
  if (!match) throw new Error('no link in the reset email');
  return new URL(match[0]);
}

/** The `data` object the service asked Prisma to write. */
function created(create: jest.Mock): {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  requestedFrom: string | null;
} {
  expect(create).toHaveBeenCalledTimes(1);
  const [argument] = create.mock.calls[0] as [
    { data: { userId: string; tokenHash: string; expiresAt: Date; requestedFrom: string | null } },
  ];
  return argument.data;
}

describe('PasswordResetService.request', () => {
  it('refuses with a 503 before it looks anybody up when there is no mailer', async () => {
    const { service, userFindUnique, send } = build({ mailConfigured: false });

    await expect(service.request('vic@example.com', null)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    // The ordering is the test. A 503 raised after the lookup would still be
    // a 503, and would also be the one reply in this flow that can differ
    // between a known address and an unknown one.
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('says nothing and does nothing for an address with no account', async () => {
    const { service, create, send } = build({ user: null });

    await expect(service.request('nobody@example.com', null)).resolves.toBeUndefined();

    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('normalises the address before looking it up', async () => {
    const { service, userFindUnique } = build();

    await service.request('  VIC@Example.COM ', null);

    expect(userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'vic@example.com' } }),
    );
  });

  it('stores the hash of the token and never the token', async () => {
    const { service, create, send } = build();

    await service.request('vic@example.com', '203.0.113.7');

    const token = linkFrom(send).searchParams.get('token');
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const row = created(create);
    expect(row.tokenHash).toBe(sha256(token as string));
    // The two halves of rule 2: the digest matches, and the plaintext that
    // produced it is nowhere in what was written.
    expect(row.tokenHash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.requestedFrom).toBe('203.0.113.7');
  });

  it('cancels any outstanding link for the account in the same transaction', async () => {
    const { service, deleteMany, prisma } = build();

    await service.request('vic@example.com', null);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1', usedAt: null } });
  });

  it('dates the expiry from the configured TTL', async () => {
    const clock = withClock(NOW);
    try {
      const { service, create, send } = build({ ttlMinutes: 45 });

      await service.request('vic@example.com', null);

      expect(created(create).expiresAt).toEqual(new Date(NOW + 45 * 60_000));
      expect(sentMessage(send).text).toContain('45 minutes');
    } finally {
      clock.restore();
    }
  });

  it('builds the link from APP_URL, trailing slash and all', async () => {
    const { service, send } = build({ appUrl: 'https://vibevic.example/' });

    await service.request('vic@example.com', null);

    const link = linkFrom(send);
    expect(link.origin).toBe('https://vibevic.example');
    expect(link.pathname).toBe('/newsroom-access/reset');
  });

  it('sends to the address on the account', async () => {
    const { service, send } = build();

    await service.request('vic@example.com', null);

    expect(sentMessage(send).to).toBe('vic@example.com');
  });

  it('takes the row back out again when the email does not go', async () => {
    const { service, send, deleteOne } = build();
    send.mockRejectedValue(new Error('provider is down'));

    await expect(service.request('vic@example.com', null)).rejects.toThrow('provider is down');

    // Otherwise the account carries an outstanding reset for a link nobody
    // received, which rule 3 will then silently cancel on the next attempt.
    expect(deleteOne).toHaveBeenCalledWith({ where: { id: 'reset_1' } });
  });
});

describe('PasswordResetService request throttling', () => {
  it('sends three links per address and then quietly stops', async () => {
    const { service, send } = build();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.request('vic@example.com', null);
      send.mockClear();
    }

    // The fourth resolves like the others — a visible refusal here would be
    // the one reply that distinguishes an address worth throttling.
    await expect(service.request('vic@example.com', null)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('counts per address', async () => {
    const { service, send } = build();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.request('vic@example.com', null);
    }
    send.mockClear();

    await service.request('someone@example.com', null);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('forgets the count once the window has passed', async () => {
    const clock = withClock(NOW);
    try {
      const { service, send } = build();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await service.request('vic@example.com', null);
      }
      send.mockClear();

      await service.request('vic@example.com', null);
      expect(send).not.toHaveBeenCalled();

      clock.advance(15 * 60 * 1000 + 1);

      await service.request('vic@example.com', null);
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      clock.restore();
    }
  });
});

describe('PasswordResetService.reset', () => {
  const live: ResetRow = {
    id: 'reset_1',
    userId: 'user_1',
    expiresAt: new Date(NOW + 10 * 60_000),
    usedAt: null,
  };

  it('looks the link up by its hash, never by the token itself', async () => {
    // The fixture's expiry is relative to NOW, so the clock has to be there
    // too — otherwise this reads as an expired link rather than a lookup.
    const clock = withClock(NOW);
    try {
      const { service, resetFindUnique } = build({ reset: live });

      await service.reset('a'.repeat(64), 'a decent long passphrase');

      expect(resetFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: sha256('a'.repeat(64)) } }),
      );
    } finally {
      clock.restore();
    }
  });

  it('refuses a token that matches nothing', async () => {
    const { service } = build({ reset: null });

    await expect(service.reset('nope', 'a decent long passphrase')).rejects.toThrow(
      /not valid/,
    );
  });

  it('refuses a link that has already been spent', async () => {
    const { service, prisma } = build({
      reset: { ...live, usedAt: new Date(NOW - 60_000) },
    });

    await expect(service.reset('token', 'a decent long passphrase')).rejects.toThrow(
      /already been used/,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an expired link', async () => {
    const clock = withClock(NOW);
    try {
      const { service, prisma } = build({
        reset: { ...live, expiresAt: new Date(NOW - 1) },
      });

      await expect(service.reset('token', 'a decent long passphrase')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    } finally {
      clock.restore();
    }
  });

  it('sets the new hash and moves the revocation clock in one transaction', async () => {
    const clock = withClock(NOW);
    try {
      const { service, prisma, hash, update, deleteMany } = build({ reset: live });

      await service.reset('token', 'a decent long passphrase');

      expect(hash).toHaveBeenCalledWith('a decent long passphrase');

      // Rule 4. `tokensValidFrom` moving with the hash is what makes a reset
      // an answer to "someone else may have my password" rather than a way to
      // change it while their session keeps running.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { passwordHash: '$argon2id$new-hash', tokensValidFrom: new Date(NOW) },
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'reset_1' },
        data: { usedAt: new Date(NOW) },
      });

      // And nothing else outstanding survives it.
      expect(deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', usedAt: null, NOT: { id: 'reset_1' } },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    } finally {
      clock.restore();
    }
  });
});
