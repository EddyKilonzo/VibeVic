import { SetMetadata } from '@nestjs/common';
import type { PublicView } from '../serialization/public-view';

/**
 * Which surface a route belongs to.
 *
 * There is no "unmarked" surface: anything without an explicit decorator is
 * treated as NEWSROOM by the guard and by the serialisation interceptor. That
 * ordering is the whole design — forgetting a decorator produces a route that
 * is locked down, never one that is open. A developer notices "my endpoint
 * 401s" immediately; nobody notices "my endpoint leaked" until it is too late.
 */
export enum Surface {
  /** Unauthenticated reader traffic. Output must pass a declared public view. */
  Public = 'public',
  /** Authenticated journalist traffic. Newsroom records may be returned. */
  Newsroom = 'newsroom',
}

export const SURFACE_KEY = 'vv:surface';
export const PUBLIC_VIEW_KEY = 'vv:public-view';

/**
 * Marks a route as reader-facing.
 *
 * The view is mandatory, not optional-with-a-fallback: the interceptor needs a
 * projection it can trust, and "no view declared" must mean "refuse to
 * respond", not "respond with whatever the service returned".
 */
export function PublicRead<TIn, TOut>(
  view: PublicView<TIn, TOut>,
): MethodDecorator & ClassDecorator {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    SetMetadata(SURFACE_KEY, Surface.Public)(target, key as string, descriptor as PropertyDescriptor);
    SetMetadata(PUBLIC_VIEW_KEY, view)(target, key as string, descriptor as PropertyDescriptor);
  };
}

/**
 * Explicit opposite of `@PublicRead`. Redundant with the default, and worth
 * writing anyway on newsroom controllers so the intent is visible at the top of
 * the file rather than inferred from an absence.
 */
export const NewsroomOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SURFACE_KEY, Surface.Newsroom);

/** Requires a scope in addition to authentication. */
export const RequireScopes = (...scopes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);

export const REQUIRED_SCOPES_KEY = 'vv:required-scopes';
