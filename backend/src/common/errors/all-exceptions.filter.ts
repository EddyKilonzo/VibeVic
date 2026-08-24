import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * The last catch, and the line between the server's log and the client's screen.
 *
 * Without it, three ordinary client mistakes — a duplicate slug, a beat that
 * does not exist, a malformed block — all arrive as `500 Internal server
 * error`. That is wrong twice over: the caller cannot tell a mistake they can
 * fix from an outage they cannot, and a 500 in the logs stops meaning anything
 * because most of them are somebody sending the wrong slug.
 *
 * ── Why no driver text ever reaches the response ─────────────────────────
 * Prisma's error messages quote the failing query, and for this schema the
 * parameters of a failing query are source names, quote text and interview
 * notes. That makes an echoed database error a newsroom leak with a stack
 * trace attached — the same failure the serialisation tripwire exists to
 * prevent, arriving through the error path instead of the success path. So
 * every branch below constructs its own sentence, and the original goes to the
 * logger and nowhere else.
 *
 * Field *names* are treated differently from field *values*: "slug already
 * exists" names a column, which is public knowledge about the shape of the
 * API, and it is the difference between a usable error and a riddle.
 */

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  [key: string]: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = translate(exception);

    /**
     * The log line carries the method, the path and the status — never the
     * request body. On this API a logged body is a logged source.
     *
     * 5xx gets the stack because somebody has to fix it. 4xx does not: a wall
     * of stack traces for people mistyping slugs is how the genuinely broken
     * thing gets missed.
     */
    const where = `${request.method} ${request.originalUrl ?? request.url}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${where} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${where} -> ${status}`);
    }

    if (response.headersSent) {
      // Streaming had already begun, so the status line is long gone. Ending
      // the response is all that is left; pretending otherwise would hang it.
      response.end();
      return;
    }

    response.status(status).json(body);
  }
}

function translate(exception: unknown): { status: number; body: ErrorBody } {
  /**
   * Anything the application threw on purpose passes through untouched.
   *
   * This matters more than it looks. AccessPolicyService answers a confidential
   * id with 404 rather than 403 so the response does not confirm the record
   * exists, and updateWithOptimisticLock returns a 409 carrying
   * `currentUpdatedAt` so a client can show a real conflict. Both are careful
   * decisions expressed as exceptions, and a filter that rewrote them into a
   * house style would quietly undo the first and break the second.
   */
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return {
        status,
        body: { statusCode: status, error: nameFor(status), message: payload },
      };
    }
    return { status, body: payload as ErrorBody };
  }

  // Blocks that failed the union on the write path. The caller sent something
  // this API does not accept, which is a 400 and not a server fault.
  if (exception instanceof ZodError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: exception.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        ),
      },
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrisma(exception);
  }

  // The database was unreachable when the client was created. Not the caller's
  // fault and not permanent, so 503 with a Retry-After-shaped meaning rather
  // than a 500 that says "this request will never work".
  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      body: {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'The service cannot reach its database. Try again shortly.',
      },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong. The details are in the server log.',
    },
  };
}

/**
 * The Prisma codes that a correct client can still trigger.
 *
 * Only these four are translated. Every other code is a query this codebase
 * built wrongly — a bug, not a request problem — and answering those with a
 * 400 would tell the caller to fix something on their side that they cannot
 * see and did not cause.
 */
function fromPrisma(
  error: Prisma.PrismaClientKnownRequestError,
): { status: number; body: ErrorBody } {
  const fields = targetFields(error);
  const named = fields.length > 0 ? ` (${fields.join(', ')})` : '';

  switch (error.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        body: {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: `A record with that value already exists${named}.`,
          fields,
        },
      };

    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: `That refers to a record which does not exist${named}.`,
          fields,
        },
      };

    case 'P2014':
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'That change would break a link between two records.',
        },
      };

    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        body: {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Record not found.',
        },
      };

    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Something went wrong. The details are in the server log.',
        },
      };
  }
}

/**
 * Column names out of Prisma's `meta`, and nothing else out of it.
 *
 * `meta.target` is a list of column names on P2002 and a single field name on
 * P2003. Both are schema identifiers. Everything else in `meta` can carry
 * values, so nothing else in it is read.
 */
function targetFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta;
  if (!meta || typeof meta !== 'object') return [];

  const target = (meta as { target?: unknown }).target;
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((f): f is string => typeof f === 'string');

  const field = (meta as { field_name?: unknown }).field_name;
  if (typeof field === 'string') return [columnFromConstraint(field)];

  return [];
}

/**
 * `stories_genreSlug_fkey (index)` -> `genreSlug`.
 *
 * On a foreign-key violation Prisma reports the constraint, not the column, and
 * Postgres names constraints `<table>_<column>_fkey`. Handing that string to a
 * client verbatim tells them about the index rather than about the field they
 * got wrong, which is the one thing they came to find out.
 *
 * Anything not matching the convention is returned untouched — a guess that
 * mangles an unrecognised name would be worse than the raw name.
 */
function columnFromConstraint(raw: string): string {
  const name = raw.replace(/\s*\(index\)\s*$/, '');
  if (!name.endsWith('_fkey')) return name;

  const withoutSuffix = name.slice(0, -'_fkey'.length);
  const separator = withoutSuffix.indexOf('_');
  return separator === -1 ? withoutSuffix : withoutSuffix.slice(separator + 1);
}

function nameFor(status: number): string {
  return (
    Object.entries(HttpStatus).find(([, value]) => value === status)?.[0] ??
    'Error'
  )
    .toLowerCase()
    .split('_')
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');
}
