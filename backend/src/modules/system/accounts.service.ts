import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { normaliseEmail } from '../auth/auth.service';
import { PasswordResetService } from '../auth/password-reset.service';
import { ROLE_SCOPES } from '../auth/roles';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAccountDto } from './account.dto';

/**
 * Who can sign in, administered from the workspace rather than from a shell.
 *
 * ── What this replaces, and what it deliberately does not ────────────────
 * `prisma/accounts.ts` — `npm run account -- add|link|list`. That tool is not
 * going anywhere: it is the way in when there is no mailer configured and the
 * way to create the very first account, before anybody can sign in to use
 * this. What it should not be is the *only* way, because it requires a shell
 * with the production `DATABASE_URL` in it, and "add a colleague" should not
 * be an operation that needs that.
 *
 * ── Why no password ever passes through here ─────────────────────────────
 * The same argument the CLI makes, and it survives the move to HTTP intact.
 * An account is created with `passwordHash` null — a real state, not a
 * defect — and the person whose account it is chooses the password from a
 * single-use link sent to their address. Nobody else holds it at any point,
 * including the administrator who created the account.
 *
 * ── Why there is no endpoint that changes a role ─────────────────────────
 * `system:accounts` is a DEV scope, and `newsroom:confidential` is not. An
 * endpoint that could move an account between roles would let the account
 * that cannot see a protected identity grant itself the ability to — which
 * would make the whole split decorative. Creating an account is bounded by
 * the mailbox (see `PasswordResetService.issueFor`); changing an existing
 * one's role is not bounded by anything, so it stays where it was: a
 * deliberate act at a database prompt, by somebody who already has that
 * access.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
    private readonly resets: PasswordResetService,
  ) {}

  /**
   * Every account, and enough about each to answer "why can they not get in".
   *
   * `passwordHash` is selected and immediately reduced to a boolean, exactly
   * as the CLI does it — a screen that renders digests is a screen somebody
   * eventually screenshots.
   */
  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'system:accounts');

    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        lastLoginAt: true,
        createdAt: true,
        // An outstanding link is the answer to "I sent them one, did it
        // arrive" — or at least to "was one ever minted". The token is not in
        // this table, so nothing here is a credential.
        passwordResets: {
          where: { usedAt: null, expiresAt: { gt: new Date() } },
          select: { expiresAt: true },
          orderBy: { expiresAt: 'desc' },
          take: 1,
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasPassword: user.passwordHash !== null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      pendingLinkExpiresAt: user.passwordResets[0]?.expiresAt.toISOString() ?? null,
      /**
       * What this role may do, sent alongside so the screen does not have to
       * keep its own copy of the table. `roles.ts` decides; this reports.
       */
      scopes: [...ROLE_SCOPES[user.role]],
    }));
  }

  /**
   * Create an account and send its owner the link that sets its password.
   *
   * The two halves are deliberately not one transaction. If the account
   * commits and the email fails, the right outcome is an account that exists
   * with no password and a clear error telling the administrator to send the
   * link again — not a rolled-back creation that leaves them wondering
   * whether it half worked. `issueFor` cleans up its own reset row on a send
   * failure, so nothing is left dangling either way.
   */
  async create(principal: Principal | undefined, dto: CreateAccountDto, from: string | null) {
    this.policy.requireScope(principal, 'system:accounts');

    const email = normaliseEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Not an upsert, for the reason the CLI gives: silently changing
      // somebody's role because a form was submitted twice is exactly the
      // quiet permission change `roles.ts` exists to prevent.
      throw new ConflictException(
        `${email} already has an account (${existing.role}). Send them a new setup link instead.`,
      );
    }

    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), role: dto.role },
      select: { id: true, email: true, role: true },
    });

    this.logger.log(`Account created for ${user.email} as ${user.role}.`);
    await this.resets.issueFor(user.id, from);

    return { id: user.id, email: user.email, role: user.role };
  }

  /**
   * Send a fresh setup link to an account that already exists.
   *
   * Works whether or not they have a password: for a new colleague it is the
   * first one, and for somebody locked out it is the reset they would
   * otherwise ask for at the door. In the second case it ends their existing
   * sessions when spent, which is `PasswordResetService`'s rule 4 and is the
   * behaviour somebody asking for this actually wants.
   */
  async issueLink(principal: Principal | undefined, id: string, from: string | null) {
    this.policy.requireScope(principal, 'system:accounts');
    if (!id.trim()) throw new BadRequestException('No account named.');

    await this.resets.issueFor(id, from);
    return { sent: true } as const;
  }
}

/** Re-exported so the DTO and the controller agree on one enum. */
export { Role };
