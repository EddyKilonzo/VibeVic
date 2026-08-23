/**
 * Where the newsroom lives.
 *
 * ── Read this before treating it as a security control ───────────────────
 * Moving the workspace off `/admin` is noise reduction, not protection. The
 * path reaches the client either way: it is in the navigation of every
 * workspace page, in the JavaScript bundle, in the browser history of anyone
 * who has signed in, and in the `next` parameter on the sign-in URL. Anybody
 * who wants it can have it in a minute.
 *
 * What it does buy is that the automated half of the internet stops finding
 * the door. Scanners try `/admin`, `/wp-admin`, `/administrator` and a few
 * hundred others; they do not guess. Fewer sign-in attempts against the gate
 * means the rate limiter is watching people rather than bots, and the logs
 * mean something.
 *
 * So: worth doing, worth one variable, and never a reason to relax the lock.
 * The lock is `middleware.ts` and the signed session in `newsroom-token.ts`.
 *
 * Set `NEXT_PUBLIC_NEWSROOM_BASE=/whatever-you-like` to move it. One path
 * segment, letters, digits and hyphens — the middleware maps exactly one
 * level onto the real route tree, so a value with a slash inside it would map
 * to nothing and a value that is empty would mount the workspace on the site
 * root. Anything that fails those rules falls back to the default rather than
 * mounting somewhere half-guarded.
 *
 * It used to be a fixed list of three names, because a middleware matcher has
 * to be statically analysable and cannot read the environment. Three
 * predictable names is barely better than one, which defeats the only thing
 * this buys — so the matcher is broad now and the mount is decided here, in
 * code, where an arbitrary value can be honoured. The cost is that the
 * middleware runs on every request and returns immediately for anything that
 * is not the workspace; `middleware.ts` says so where it does it.
 */
const RAW = process.env.NEXT_PUBLIC_NEWSROOM_BASE?.trim();

/** The default, and what the route folder is actually called on disk. */
export const ROUTE_ROOT = "/admin";

function sane(base: string | undefined): string {
  if (!base) return ROUTE_ROOT;
  const trimmed = base.replace(/\/+$/, "").toLowerCase();
  return /^\/[a-z0-9][a-z0-9-]{1,48}$/.test(trimmed) ? trimmed : ROUTE_ROOT;
}

export const NEWSROOM_BASE = sane(RAW);

/** True once the workspace has been moved off the guessable default. */
export const NEWSROOM_MOVED = NEWSROOM_BASE !== ROUTE_ROOT;

/** `newsroomPath("/stories")` → `/desk-7f3a/stories`. */
export function newsroomPath(path = ""): string {
  return `${NEWSROOM_BASE}${path}`;
}

/**
 * The part of a path after the mount, whichever address it arrived on.
 *
 * Navigation compares where you are against where a link goes, and those two
 * are not guaranteed to be spelled the same way: the browser holds the public
 * path while the server rendered the rewritten one, and which of them
 * `usePathname` reports during hydration is a detail of the router rather
 * than a promise. Comparing suffixes is true either way.
 */
export function newsroomSuffix(pathname: string): string {
  for (const prefix of [NEWSROOM_BASE, ROUTE_ROOT]) {
    if (pathname === prefix) return "";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}
