import { z } from 'zod';

/**
 * Environment validation.
 *
 * Validated at boot and thrown on rather than defaulted, because the dangerous
 * failures here are silent ones: an auth mode that quietly falls back to "open"
 * or a missing signing secret that quietly becomes an empty string would both
 * produce a server that starts happily and leaks. Refusing to start is the
 * loudest available signal.
 */

export const AUTH_MODES = ['disabled', 'dev', 'jwt'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    /**
     * The unpooled endpoint, read only by `prisma migrate` via the datasource
     * block. Optional here on purpose: the running server never opens it, so a
     * runtime-only container that was handed no migration credential should
     * still boot. A deploy that runs migrations does need it, and will fail
     * loudly at the CLI rather than silently at runtime.
     */
    DIRECT_URL: z.string().optional(),

    /** Comma-separated. Absent means: allow no browser origin at all. */
    CORS_ORIGINS: z.string().optional().default(''),

    AUTH_MODE: z.enum(AUTH_MODES).default('disabled'),
    AUTH_JWT_SECRET: z.string().optional(),
    DEV_PRINCIPAL_TOKEN: z.string().optional(),
    DEV_PRINCIPAL_EMAIL: z.string().optional(),
    /**
     * Whether the dev principal also holds `newsroom:confidential`.
     *
     * Off by default, and the default is the argued position: a mode that
     * exists so a developer does not have to log in should not also hand out
     * the identities behind pseudonyms. But leaving it permanently off makes
     * two collections untestable on a workstation — interviews default to
     * CONFIDENTIAL, so they cannot be created and do not appear in a list —
     * and an API surface nobody can exercise is one nobody finds the bugs in.
     *
     * So it is an opt-in that has to be typed out, not a quiet default. It is
     * unreachable in production for the same reason AUTH_MODE=dev is: the
     * superRefine below refuses that combination at boot.
     */
    DEV_PRINCIPAL_CONFIDENTIAL: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((value) => value === 'true'),

    /**
     * How long a session lasts.
     *
     * Twelve hours by default, matching the frontend cookie: one working day,
     * not forever. There is no refresh token, so this is the whole answer to
     * "how long until I sign in again" — and a longer window is not free,
     * because a JWT that has been signed cannot be called back. Revocation
     * exists (`User.tokensValidFrom`), but it is a blunt instrument that ends
     * every session at once; the ordinary limit on a stolen token is this
     * number.
     */
    AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(720),

    /**
     * Where the newsroom's browser side lives, used to build the reset link.
     *
     * Configuration rather than the request's own Host header, and that is the
     * point. Reading the host off an unauthenticated request would let anyone
     * who can reach this endpoint choose the domain in an email this server
     * sends — the classic host-header password-reset poisoning, where the
     * victim clicks a real message and hands their token to somebody else's
     * site. A value from the environment cannot be typed by a caller.
     */
    APP_URL: z.string().url().optional(),

    /* ── Email: SMTP ────────────────────────────────────────────────────
     * Optional as a group. With none of it set the server runs and refuses
     * password resets with a 503 that names what is missing, which is the
     * honest answer for a deployment that has not been given a way to send.
     *
     * SMTP rather than a provider SDK. This was Resend's HTTP API and is now
     * Brevo's relay, and the only code that changed is a transport — which is
     * the argument for the protocol over the SDK. A provider package puts a
     * vendor's name in the import list of a service whose job is "send this
     * text to this address", and moving between them means a rewrite rather
     * than four variables. Brevo, Resend, Postmark, SES and a self-hosted
     * Postfix all speak this.
     */
    SMTP_HOST: z.string().optional(),
    // Brevo's relay answers on 587 and 2525; 465 is implicit TLS. The
    // transport reads the number to decide which, so it is not a free-form
    // detail — see `MailService`.
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /** RFC 5322, so `VicUnfiltered <vic@example.com>` is valid and expected. */
    SMTP_FROM: z.string().optional(),
    /**
     * The bare address mail is sent from, when it differs from the display
     * form above. Brevo calls this the sender and verifies it; some relays
     * reject an envelope sender that is not the verified one even when the
     * `From` header renders a name. Optional, and only used when set.
     */
    SENDER_EMAIL: z.string().email().optional(),
    MAIL_REPLY_TO: z.string().email().optional(),

    /**
     * How long a reset link stays good. Thirty minutes: long enough to walk
     * to another device and find the email, short enough that a link sitting
     * in a mailbox someone else later reads is usually already dead.
     */
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().max(240).default(30),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'jwt' && (env.AUTH_JWT_SECRET ?? '').length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_JWT_SECRET'],
        message:
          'AUTH_MODE=jwt requires AUTH_JWT_SECRET of at least 32 characters.',
      });
    }

    // The dev principal is a convenience that bypasses a real login. Allowing
    // it in production would make every other control in this codebase
    // decorative, so it is a boot failure rather than a warning.
    if (env.AUTH_MODE === 'dev' && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_MODE'],
        message: 'AUTH_MODE=dev is refused when NODE_ENV=production.',
      });
    }

    if (env.AUTH_MODE === 'dev' && (env.DEV_PRINCIPAL_TOKEN ?? '').length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEV_PRINCIPAL_TOKEN'],
        message:
          'AUTH_MODE=dev requires DEV_PRINCIPAL_TOKEN of at least 16 characters. Generate your own; there is no default.',
      });
    }

    /*
     * A half-configured mailer fails at send time, which means the failure
     * arrives as a 503 during somebody's password reset rather than at boot,
     * when there is a person watching a log who can fix it.
     *
     * "Configured at all" is a host. Once there is one, the rest is required:
     * a relay with no credentials is an open relay's worth of wishful
     * thinking, and one with no from-address is rejected by every provider.
     */
    const mailStarted = Boolean(env.SMTP_HOST);
    if (mailStarted) {
      for (const [key, value] of [
        ['SMTP_USER', env.SMTP_USER],
        ['SMTP_PASS', env.SMTP_PASS],
        ['SMTP_FROM', env.SMTP_FROM],
      ] as const) {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `SMTP_HOST is set but ${key} is not. A half-configured mailer fails at send time, in front of somebody who has lost their password.`,
          });
        }
      }

      /*
       * A mailer with nowhere to point. A reset email whose link is built
       * from a missing APP_URL is a message that cannot be acted on, and
       * discovering that requires a person to have already lost their
       * password.
       */
      if (!env.APP_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_URL'],
          message: 'SMTP_HOST is set but APP_URL is not. Reset links have no origin to point at.',
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(withoutBlanks(raw));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  return parsed.data;
}

/**
 * An empty variable is an unset variable.
 *
 * ── The failure this fixes ───────────────────────────────────────────────
 * A `.env` written the way people write them —
 *
 *     # Optional. Where a reply should go, if not the from address.
 *     MAIL_REPLY_TO=
 *
 * — hands this schema an empty string, not `undefined`. So `.optional()` does
 * not apply, `.email()` runs on "", and the server refuses to boot with
 * "MAIL_REPLY_TO: Invalid email" about a variable whose whole point is that
 * it does not have to be set. The same trap was waiting on APP_URL's `.url()`
 * and on every optional field added after them.
 *
 * Stripping blanks before parsing makes the file mean what it looks like it
 * means: a key with nothing after the `=` is a key nobody filled in, which is
 * how dotenv files are actually used and how a commented-out line behaves.
 *
 * Whitespace counts as blank too — a trailing space after `=` is invisible in
 * an editor and would otherwise be a value.
 *
 * This only ever turns a value into no value, so nothing it does can make a
 * required variable pass: `DATABASE_URL=` still fails, and now it fails
 * saying it is required rather than that it is not a URL.
 */
function withoutBlanks(raw: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    kept[key] = value;
  }
  return kept;
}

/**
 * Takes only the field it reads, so a caller holding a ConfigService can pass
 * that one value instead of reassembling a whole Env to ask a question about
 * one string.
 */
export function corsOrigins(env: Pick<Env, 'CORS_ORIGINS'>): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
