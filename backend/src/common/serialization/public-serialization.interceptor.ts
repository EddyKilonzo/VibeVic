import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  PUBLIC_VIEW_KEY,
  SURFACE_KEY,
  Surface,
} from '../authz/surface.decorator';
import { assertNoNewsroomFields } from './newsroom-leak.tripwire';
import { applyPublicView, isPublicView, type PublicView } from './public-view';

/**
 * Global response filter for the public surface.
 *
 * Registered globally so it cannot be forgotten on a new controller. On a route
 * marked `@PublicRead(view)` it discards whatever the service returned and
 * sends the projection instead; on any other route it passes the value through
 * untouched, because newsroom routes are behind the guard and are meant to
 * return newsroom records.
 *
 * Three ways this fails closed:
 *   1. A route marked public with no declared view → 500, not a raw payload.
 *   2. A projection that throws (a draft story, an unparseable body) → 500.
 *   3. A projection whose output still smells of newsroom fields → 500.
 * In every case the offending body is dropped before it reaches the socket, and
 * the detail stays in the server log rather than in the client's error message.
 */
@Injectable()
export class PublicSerializationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PublicSerializationInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const surface =
      this.reflector.getAllAndOverride<Surface>(SURFACE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? Surface.Newsroom;

    if (surface !== Surface.Public) return next.handle();

    const view = this.reflector.getAllAndOverride<PublicView<unknown, unknown>>(
      PUBLIC_VIEW_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((value) => {
        if (!isPublicView(view)) {
          // Only reachable if someone sets the surface metadata by hand instead
          // of using @PublicRead. Refusing is the only safe reading of it.
          this.logger.error(
            `Public route ${context.getClass().name}.${context.getHandler().name} has no declared public view.`,
          );
          throw new InternalServerErrorException('Response could not be serialised.');
        }

        try {
          const projected = applyPublicView(view, value);
          assertNoNewsroomFields(projected);
          return projected;
        } catch (error) {
          this.logger.error(
            `Refused public response from ${context.getClass().name}.${context.getHandler().name} ` +
              `via ${view.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw new InternalServerErrorException('Response could not be serialised.');
        }
      }),
    );
  }
}
