import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { corsOrigins, type Env } from './config/env';

/**
 * Boot.
 *
 * Almost everything here is a decision about what the process refuses to do.
 * The env schema has already run by the time `create` returns — a bad
 * AUTH_MODE or a missing DATABASE_URL throws inside ConfigModule and this
 * function never reaches its second line. That is the loudest failure
 * available, and much better than a server that starts with authentication
 * quietly off.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // These are API responses, not browser documents, but the framing and
  // content-type headers helmet sets cost nothing and stop a response being
  // embedded or sniffed if one is ever opened directly in a tab.
  app.use(helmet());

  /**
   * The JSON parser also accepts `text/plain`, for one caller.
   *
   * `navigator.sendBeacon` is what reports a finished read, and it fires at the
   * moment the reader closes the tab. A beacon with `Content-Type:
   * application/json` is a preflighted cross-origin request, and a preflight
   * cannot complete during unload — so the count would be lost precisely for
   * the readers who reached the end, which would bias the one metric that says
   * whether anybody finishes. A `text/plain` body is a "simple request" and
   * goes straight out.
   *
   * The body is still JSON and is still validated by the same DTO; only the
   * header differs. Nothing else in this API accepts `text/plain`, so the
   * widened parser has exactly one user and a malformed body still 400s.
   */
  app.use(json({ type: ['application/json', 'text/plain'] }));

  /**
   * An allowlist read from validated config, never a wildcard.
   *
   * An empty CORS_ORIGINS means no browser origin is allowed at all, and that
   * is the intended reading rather than an oversight: a deployment that forgot
   * to name its frontend should serve nothing to a browser rather than serve
   * everyone. `credentials` stays off — the newsroom authenticates with an
   * Authorization header, not a cookie, so there is no reason to let a browser
   * attach ambient credentials to a cross-origin call.
   */
  app.enableCors({
    origin: corsOrigins({ CORS_ORIGINS: config.get('CORS_ORIGINS', { infer: true }) }),
    // PUT is here for the two idempotent setters — a story's portfolio class
    // and the house style guide. Leaving it out made those routes exist and be
    // unreachable from a browser, which is the worst of both: the preflight
    // fails with a CORS message that names no route and sends whoever hits it
    // looking for a bug in the handler.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  /**
   * `whitelist` strips properties no DTO declared; `forbidNonWhitelisted` turns
   * an undeclared property into a 400 instead. Both, deliberately: a client
   * sending a field the server does not model is either out of date or probing,
   * and silently accepting it is how a request ends up carrying a `visibility`
   * or a `protectedIdentity` that no DTO asked for.
   *
   * `enableImplicitConversion` is off. Implicit coercion would let the string
   * "false" arrive as a boolean `true` on a field like `placeholder`, and a
   * silently flipped flag on a publishing decision is not a tradeoff worth
   * making for the convenience of not writing @Type().
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Everything under /api, except health. A load balancer's probe should not
  // have to know the application's URL layout, and keeping /health at the root
  // means the prefix can change later without breaking the thing that watches
  // whether the service is alive.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // Without this, SIGTERM kills the process before PrismaService.onModuleDestroy
  // runs, and connections are left for Neon to time out rather than closed.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port} (prefix /api, health at /health)`);
  logger.log(`AUTH_MODE=${config.get('AUTH_MODE', { infer: true })}`);
}

/**
 * Boot failures, said in one line instead of forty.
 *
 * `void bootstrap()` on its own turns every startup problem into an unhandled
 * promise rejection: a zod stack trace for a typo in .env, a Node errno dump
 * for a port already in use. Both bury the fix under the trace. The three that
 * actually happen get named here, and the stack still follows for anything
 * genuinely unexpected.
 *
 * Exit code 1 in every case, so a process manager, a container and CI all agree
 * that this did not start.
 */
bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith('Invalid environment configuration')) {
    // validateEnv has already listed the offending keys; repeating the list
    // would be noise, but saying which file to open is not.
    logger.error(`${message}\n\n  Fix these in backend/.env — see .env.example.`);
  } else if (isErrno(error, 'EADDRINUSE')) {
    logger.error(
      `Port ${process.env.PORT ?? 4000} is already in use. ` +
        'Another copy of the API is probably still running.',
    );
  } else if (isErrno(error, 'EACCES')) {
    logger.error(`Not allowed to bind port ${process.env.PORT ?? 4000}.`);
  } else {
    logger.error(`The API failed to start: ${message}`, error instanceof Error ? error.stack : undefined);
  }

  process.exit(1);
});

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === code
  );
}
