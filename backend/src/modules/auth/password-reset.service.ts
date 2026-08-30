import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates/password-reset';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { normaliseEmail } from './auth.service';
import { PasswordService } from './password.service';

/**
 * "I have forgotten the password."
 *
 * ── The rules this flow is built on ──────────────────────────────────────
 * 1. The endpoint that sends the email answers the same way whether or not
 *    the address has an account. A reset form that says "no such user" is a
 *    list of the newsroom's journalists, available to anyone with a browser.
 * 2. The token is never stored. What goes in the table is its SHA-256, so a
 *    copy of the database is not a set of working keys to everybody's
 *    account — see the note on `PasswordReset` in schema.prisma.
 * 3. One outstanding link per account. Asking again cancels the last one, so
 *    a mailbox never holds two live keys and the most recent email is always
 *    the one that works.
 * 4. Spending a link ends every session. Someone resetting a password is
 *    quite often someone who thinks another person has it, and leaving that
 *    person's existing token alive for another twelve hours would answer the
 *    wrong half of the problem.
 *
 * ── What it still does not do ────────────────────────────────────────────
 * There is no notification to the account when the password actually
 * changes, which is the other email worth sending and is not written yet.
 * The throttle below is per instance and per address, with the same honest
 * limits as the one in AuthService.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly passwords: PasswordService,
    private readonly limiter: RateLimitService,
  ) {}

  /**
   * Issue a link, if there is anyone to send it to.
   *
   * Returns nothing in every case, including the case where the address is
   * unknown. The caller answers 202 unconditionally — see rule 1 above.
   *
   * The one exception that is allowed to be visible is a server with no
   * mailer: that is checked first, before any lookup, so the 503 it raises
   * cannot depend on whether the address exists.
   */
  async request(email: string, requestedFrom: string | null): Promise<void> {
    if (!this.mail.configured) {
      // Named variables, because the person who can fix this is reading a
      // deploy log rather than the form. It says nothing about accounts, and
      // it is raised before any lookup so it cannot depend on one.
      throw new ServiceUnavailableException(
        'This newsroom cannot send email yet, so a reset link cannot be issued. Set RESEND_API_KEY, MAIL_FROM and APP_URL.',
      );
    }

    const address = normaliseEmail(email);

    if (!(await this.limiter.hit(RESET_SCOPE, address, RESET_LIMIT))) {
      // Returns rather than raising, and says nothing different to the
      // caller: a visible "too many requests" here would be the one reply in
      // this flow that distinguishes an address worth asking about.
      this.logger.warn(`Reset requests throttled for ${address}.`);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: address },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      // Logged, because a burst of these against addresses that do not exist
      // is worth being able to see afterwards. Not answered differently.
      this.logger.log(`Reset requested for an address with no account.`);
      return;
    }

    const minutes = this.config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true });

    /*
     * 32 bytes from the CSPRNG, hex-encoded to 64 characters.
     *
     * Not a UUID and not a cuid: both are structured, both encode a
     * timestamp, and neither is documented as unpredictable. This value's
     * only job is to be unguessable, so it is taken from the one API that
     * promises that and nothing else.
     */
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + minutes * 60_000);

    const created = await this.prisma.$transaction(async (tx) => {
      // Rule 3: the previous link stops working the moment a new one is
      // asked for, rather than both being live until they expire.
      await tx.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
      return tx.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt,
          requestedFrom,
        },
        select: { id: true },
      });
    });

    try {
      await this.mail.send(
        passwordResetEmail({
          to: user.email,
          name: user.name,
          url: this.linkTo(token),
          minutes,
        }),
      );
    } catch (cause) {
      /*
       * The row is removed when the email does not go out.
       *
       * Leaving it would be harmless in the sense that nobody holds the
       * token — but it would also mean the account has an outstanding reset
       * that rule 3 will silently cancel on the next attempt, and a live row
       * for a link nobody received is a thing that has to be explained
       * later. Cleaning up costs one statement.
       */
      await this.prisma.passwordReset.delete({ where: { id: created.id } }).catch(() => undefined);
      throw cause;
    }

    this.logger.log(`Reset link sent to ${user.email}, valid ${minutes} minutes.`);
  }

  /**
   * Spend a link and set the new password.
   *
   * ── Why this one is allowed to say what went wrong ───────────────────────
   * The enumeration argument does not apply here: to reach this method at all
   * you must already hold a 256-bit token, which is not something anybody
   * arrives at by guessing. So an expired link says it expired and a spent
   * one says it was used, because the person reading it has to know whether
   * to ask for another — and "invalid" for both would send them round the
   * loop again with no idea why.
   */
  async reset(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record) {
      throw new BadRequestException(
        'That reset link is not valid. Ask for a new one from the sign-in page.',
      );
    }
    if (record.usedAt) {
      throw new BadRequestException(
        'That reset link has already been used. Ask for a new one from the sign-in page.',
      );
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'That reset link has expired. Ask for a new one from the sign-in page.',
      );
    }

    const passwordHash = await this.passwords.hash(password);
    const now = new Date();

    await this.prisma.$transaction([
      /*
       * `tokensValidFrom` moves to now, which is rule 4: every session that
       * existed a moment ago stops verifying. It is deliberately part of the
       * same transaction as the new hash — a password change that committed
       * without the revocation would leave the old sessions alive with no
       * record that they were supposed to end.
       */
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, tokensValidFrom: now },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      // Anything else outstanding for this account goes too. The person has
      // just proved they hold the mailbox; older links are only risk.
      this.prisma.passwordReset.deleteMany({
        where: { userId: record.userId, usedAt: null, NOT: { id: record.id } },
      }),
    ]);

    this.logger.log(`Password reset completed for user ${record.userId}; sessions revoked.`);
  }

  /**
   * The address in the email.
   *
   * Built from APP_URL, never from the incoming request — see the note on
   * APP_URL in config/env.ts. `encodeURIComponent` on a hex string is
   * belt-and-braces, and stays because the day the token format changes is
   * the day someone would otherwise find out it needed escaping.
   */
  private linkTo(token: string): string {
    const base = (this.config.get('APP_URL', { infer: true }) ?? '').replace(/\/+$/, '');
    return `${base}/newsroom-access/reset?token=${encodeURIComponent(token)}`;
  }

  /* ── Request throttling ─────────────────────────────────────────────────
   * Three links per address per fifteen minutes, counted in Postgres by
   * `RateLimitService`. Low, because there is no legitimate reason to need a
   * fourth — and because each one is an email this newsroom pays for and
   * somebody's inbox receives.
   *
   * The Map that used to be here was per instance, which for this throttle
   * was worse than for the sign-in one: the thing being rationed is outbound
   * email, and a second instance meant a second allowance to send it with.
   */
}

/** The limiter's namespace for reset requests, and its allowance. */
const RESET_SCOPE = 'auth:reset-request';
const RESET_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };

/**
 * SHA-256, hex. The lookup column is unique, so this doubles as the index
 * key — which is the reason it is a plain digest with no per-row salt: a
 * salted hash cannot be looked up without reading every row to try each salt.
 * Safe here only because the input is 256 random bits; it would be wrong for
 * anything a person chose.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
