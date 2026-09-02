import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import type { Principal } from '../../common/authz/principal';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * What the deployment is actually doing, for the person who would have to fix
 * it.
 *
 * ── Why this is not `/health` with more fields ───────────────────────────
 * `HealthController` is public, and its own comment explains why it stays
 * thin: a health endpoint has a habit of growing into a debugging console,
 * and every field added to an unauthenticated route is another free fact
 * about the deployment. Every field a developer actually wants — which
 * migrations ran, whether the mailer is wired up, how many origins CORS
 * allows — is exactly the kind of fact that comment is refusing to publish.
 *
 * So the answer is not to loosen that endpoint. It is a second one, behind
 * `system:diagnostics`, which one role holds and the other does not. The
 * public route keeps saying `ok` or `degraded`; this one says why.
 *
 * ── The rule every field here obeys ──────────────────────────────────────
 * Presence and shape, never values. `smtpConfigured: true` is a fact about
 * the deployment; `SMTP_PASS` is a credential, and a diagnostics screen is
 * precisely where somebody would paste a screenshot of it into a chat. There
 * is no code path in this file that can return the contents of an
 * environment variable, and there should never be one — a boolean cannot be
 * leaked by being looked at.
 */

export interface Diagnostics {
  checkedAt: string;
  process: {
    nodeEnv: string;
    nodeVersion: string;
    uptimeSeconds: number;
    /** Resident set, in megabytes. A number a person can compare to a plan. */
    memoryMb: number;
  };
  database: {
    reachable: boolean;
    /** Round trip for `SELECT 1`, in milliseconds. Null when unreachable. */
    latencyMs: number | null;
    migrations: {
      applied: number;
      latest: string | null;
      /** Rows that started and never finished — a migration that broke. */
      unfinished: number;
      /** Null when the migrations table could not be read at all. */
      readable: boolean;
    };
  };
  /**
   * Which pieces of configuration are present. Booleans and counts only —
   * see the rule above.
   */
  configuration: {
    authMode: string;
    /** Minutes. Not a secret, and the number a stale-session report needs. */
    sessionMinutes: number;
    jwtSecretSet: boolean;
    appUrlSet: boolean;
    corsOrigins: number;
    smtpConfigured: boolean;
    directUrlSet: boolean;
  };
}

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Never throws for a degraded dependency.
   *
   * The whole value of this screen is that it still answers when something is
   * broken — a diagnostics endpoint that 500s because the database is down
   * has failed in exactly the situation it exists for. Each probe catches its
   * own failure and reports it as a field.
   */
  async read(principal: Principal | undefined): Promise<Diagnostics> {
    // The second lock. The controller carries the scope too; this is the one
    // that survives the controller being refactored.
    this.policy.requireScope(principal, 'system:diagnostics');

    const [database] = await Promise.all([this.database()]);

    return {
      checkedAt: new Date().toISOString(),
      process: {
        nodeEnv: this.config.get('NODE_ENV', { infer: true }),
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      database,
      configuration: {
        authMode: this.config.get('AUTH_MODE', { infer: true }),
        sessionMinutes: this.config.get('AUTH_TOKEN_TTL_MINUTES', { infer: true }),
        // `Boolean(...)`, never the value. See the rule in the file header.
        jwtSecretSet: Boolean(this.config.get('AUTH_JWT_SECRET', { infer: true })),
        appUrlSet: Boolean(this.config.get('APP_URL', { infer: true })),
        corsOrigins: (this.config.get('CORS_ORIGINS', { infer: true }) ?? '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean).length,
        smtpConfigured: this.mail.configured,
        directUrlSet: Boolean(this.config.get('DIRECT_URL', { infer: true })),
      },
    };
  }

  private async database(): Promise<Diagnostics['database']> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        `Diagnostics database probe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        reachable: false,
        latencyMs: null,
        migrations: { applied: 0, latest: null, unfinished: 0, readable: false },
      };
    }

    return {
      reachable: true,
      latencyMs: Date.now() - started,
      migrations: await this.migrations(),
    };
  }

  /**
   * Read from `_prisma_migrations`, which Prisma owns and does not expose
   * through the client.
   *
   * Raw SQL with no interpolation of anything a caller supplied — the query
   * is a constant. `unfinished` is the field worth having: a row with a
   * `started_at` and no `finished_at` is a migration that died half way, and
   * it is the single most common reason a deploy looks healthy and behaves as
   * though a column is missing.
   */
  private async migrations(): Promise<Diagnostics['database']['migrations']> {
    try {
      const rows = await this.prisma.$queryRaw<
        { migration_name: string; finished_at: Date | null }[]
      >`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        ORDER BY started_at ASC
      `;

      const finished = rows.filter((row) => row.finished_at !== null);
      return {
        applied: finished.length,
        latest: finished.at(-1)?.migration_name ?? null,
        unfinished: rows.length - finished.length,
        readable: true,
      };
    } catch (error) {
      // A database that answers `SELECT 1` but has no migrations table is a
      // real state — `db push` was used, or this is a fresh scratch database —
      // and it is not an error worth failing the whole report over.
      this.logger.warn(
        `Could not read _prisma_migrations: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { applied: 0, latest: null, unfinished: 0, readable: false };
    }
  }
}
