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

    /** Comma-separated. Absent means: allow no browser origin at all. */
    CORS_ORIGINS: z.string().optional().default(''),

    AUTH_MODE: z.enum(AUTH_MODES).default('disabled'),
    AUTH_JWT_SECRET: z.string().optional(),
    DEV_PRINCIPAL_TOKEN: z.string().optional(),
    DEV_PRINCIPAL_EMAIL: z.string().optional(),
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
  });

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  return parsed.data;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
