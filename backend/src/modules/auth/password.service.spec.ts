import { PasswordService } from './password.service';

/**
 * The one spec that runs the real hashing.
 *
 * Everything else fakes `PasswordService`, because argon2 is deliberately
 * expensive and a suite that pays fifty milliseconds per sign-in case stops
 * being run on every save. This file pays it a handful of times, for the
 * properties that only the real implementation has.
 *
 * ── What is actually being checked ───────────────────────────────────────
 * That a digest verifies against its own password and nothing else is the
 * obvious half. The half worth writing down is `verify` swallowing a
 * malformed digest: a truncated or hand-edited `passwordHash` in the database
 * has to be a failed login rather than a 500, because the alternative leaks —
 * a stack trace for one address and a clean refusal for another says which
 * rows are intact.
 */

// argon2id at the OWASP baseline is slow on purpose; the default 5s timeout is
// not generous once a case does three of them.
jest.setTimeout(30_000);

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('verifies a password against its own digest', async () => {
    const digest = await passwords.hash('a decent long passphrase');

    await expect(passwords.verify(digest, 'a decent long passphrase')).resolves.toBe(true);
    await expect(passwords.verify(digest, 'a decent long passphras')).resolves.toBe(false);
  });

  it('produces a different digest every time, so equal hashes never mean equal passwords', async () => {
    const [first, second] = await Promise.all([
      passwords.hash('the same passphrase'),
      passwords.hash('the same passphrase'),
    ]);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^\$argon2id\$/);
  });

  it('answers false for a malformed digest instead of throwing', async () => {
    for (const broken of ['', 'not-a-hash', '$argon2id$v=19$truncated']) {
      await expect(passwords.verify(broken, 'anything')).resolves.toBe(false);
    }
  });

  it('always refuses the decoy, whatever it is given', async () => {
    await expect(passwords.verifyDummy('anything at all')).resolves.toBe(false);
    await expect(passwords.verifyDummy('')).resolves.toBe(false);
  });
});
