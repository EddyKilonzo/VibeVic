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
  /**
   * A scheduler, holding a shared secret rather than a session.
   *
   * A third surface rather than a bearer token for a service account, and the
   * difference is what it cannot do. A service account is a principal: it has
   * scopes, it can be widened by editing a role table, and a stolen token for
   * one is a stolen token for a newsroom login. This is not a principal at
   * all — the guard never builds one, so a route on this surface has nobody to
   * ask "may I", which means it can only ever do work that needs no
   * permission. The reminder pass is exactly that shape: it reads rows the
   * writer already owns and sends them to the writer's own address.
   *
   * It is also why this cannot be reached by forgetting a decorator. The
   * default is still Newsroom; this surface has to be typed out.
   */
  Machine = 'machine',
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

/**
 * Marks a route as one a scheduler calls, authenticated by `CRON_SECRET`.
 *
 * Not a way in. There is no principal, so nothing behind this can read a
 * confidential record or act as anybody — see `Surface.Machine`. If the
 * secret is not configured the guard refuses the route entirely rather than
 * opening it, which is the same rule `AUTH_MODE` follows: an unconfigured
 * control is a closed door, never an absent one.
 */
export const MachineOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SURFACE_KEY, Surface.Machine);

/** Requires a scope in addition to authentication. */
export const RequireScopes = (...scopes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);

export const REQUIRED_SCOPES_KEY = 'vv:required-scopes';
