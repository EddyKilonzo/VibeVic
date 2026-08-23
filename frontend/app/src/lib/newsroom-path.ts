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
 * Set `NEXT_PUBLIC_NEWSROOM_BASE` to one of `MOUNTS` to move it.
 *
 * ── Why it is a list and not any string you like ─────────────────────────
 * A middleware matcher has to be statically analysable — Next reads it out of
 * the file at build time, so it cannot contain a value from the environment.
 * The matcher therefore names the mounts it will guard, and this list is the
 * same set. A base outside it would not be matched, which would mean the gate
 * never runs on it: the request would miss the rewrite and 404 rather than
 * serve anything, but "silently broken" is a worse failure than "refused", so
 * an unknown value falls back to the default instead.
 *
 * Adding a mount means editing both this array and the matcher in
 * `middleware.ts`. That is the cost of the matcher being static, and it is
 * cheap as long as the two are read together — which is why they say so.
 */
const RAW = process.env.NEXT_PUBLIC_NEWSROOM_BASE?.trim();

/** The default, and what the route folder is actually called on disk. */
export const ROUTE_ROOT = "/admin";

/** Must stay in step with the matcher in `middleware.ts`. */
export const MOUNTS = [ROUTE_ROOT, "/desk", "/newsroom"] as const;

function sane(base: string | undefined): string {
  if (!base) return ROUTE_ROOT;
  const trimmed = base.replace(/\/+$/, "").toLowerCase();
  return (MOUNTS as readonly string[]).includes(trimmed) ? trimmed : ROUTE_ROOT;
}

export const NEWSROOM_BASE = sane(RAW);

/** True once the workspace has been moved off the guessable default. */
export const NEWSROOM_MOVED = NEWSROOM_BASE !== ROUTE_ROOT;

/** `newsroomPath("/stories")` → `/desk-7f3a/stories`. */
export function newsroomPath(path = ""): string {
  return `${NEWSROOM_BASE}${path}`;
}
