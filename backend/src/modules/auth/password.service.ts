import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing.
 *
 * ── argon2id, and the parameters behind it ───────────────────────────────
 * argon2id because it is what the previous version of this file said was
 * missing, and because it is memory-hard: the attacker's advantage in buying
 * parallel hardware is bounded by RAM rather than by cores. The settings
 * below are the OWASP baseline — 19 MiB, two passes, one lane — chosen
 * because a defensible published number beats a number someone tuned once on
 * their own laptop and never revisited.
 *
 * `@node-rs/argon2` rather than the `argon2` package: it ships prebuilt
 * binaries, so a `npm install` on a machine without a C toolchain still
 * produces a server that can check a password. A build step that fails on
 * some developers' machines is a build step that gets replaced with
 * something weaker in a hurry.
 *
 * ── Why `verifyDummy` exists ─────────────────────────────────────────────
 * A login for an address with no account would otherwise answer in a
 * millisecond while a real one takes fifty, and that difference is a working
 * "does this person have an account here" oracle for anyone with a stopwatch.
 * For a newsroom that is not an abstract concern: the accounts are the
 * journalists, and confirming who has one is itself information. So the
 * no-such-user path hashes anyway and throws the result away.
 */
@Injectable()
export class PasswordService {
  private static readonly OPTIONS = {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  /**
   * A real argon2id digest of a value nobody knows, computed once at startup.
   * Its only job is to be something to compare against when there is nothing
   * to compare against.
   */
  private readonly decoy = hash(
    // Not a constant string: a fixed decoy in source is a fixed digest, and
    // there is no reason to hand anyone even that.
    Buffer.from(crypto.randomUUID() + crypto.randomUUID()),
    PasswordService.OPTIONS,
  );

  hash(password: string): Promise<string> {
    return hash(password, PasswordService.OPTIONS);
  }

  /**
   * Never throws on a bad hash — a malformed or truncated digest in the
   * database is a failed login, not a 500. The distinction matters because
   * the alternative leaks: a stack trace for one address and a clean refusal
   * for another says which rows are intact.
   */
  async verify(digest: string, password: string): Promise<boolean> {
    try {
      return await verify(digest, password);
    } catch {
      return false;
    }
  }

  /** Burns the same time as a real check, and always answers false. */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(await this.decoy, password);
    return false;
  }
}
