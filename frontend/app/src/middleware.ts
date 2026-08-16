import { NextResponse, type NextRequest } from "next/server";

/**
 * Access control for the newsroom.
 *
 * ── What this is ─────────────────────────────────────────────────────────
 * A single shared passphrase, checked at the edge before any admin route is
 * served. It is not a user system: there are no accounts, no roles and no
 * sessions beyond one signed cookie, because there is no backend to hold them.
 * For a one-person newsroom that is the right size of lock; the moment a
 * second person needs access, or the NestJS API lands, this is replaced by
 * real authentication rather than extended.
 *
 * ── Why middleware and not a client check ────────────────────────────────
 * Hiding the admin link, or redirecting from inside a React component, only
 * hides the door — the route still renders and its JavaScript still ships to
 * anyone who types the URL. Running here means an unauthenticated request for
 * `/admin/*` never receives the page at all.
 *
 * ── The cookie ───────────────────────────────────────────────────────────
 * httpOnly, sameSite=lax, secure in production, so it is unreadable from
 * JavaScript and does not ride along on cross-site requests. It holds a hash
 * of the passphrase rather than the passphrase itself, so a stolen cookie
 * cannot be read back into the secret.
 *
 * ── Deliberate failure mode ──────────────────────────────────────────────
 * With no `NEWSROOM_PASSPHRASE` set, the admin is locked rather than open.
 * A missing secret is a misconfiguration, and the safe reading of a
 * misconfigured lock is "closed" — an admin that silently unlocks itself when
 * an environment variable goes missing is how private drafts end up indexed.
 */

const COOKIE = "vv_newsroom";

/** Web Crypto — the Node crypto module is not available in the edge runtime. */
async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The sign-in page itself must stay reachable, or there is no way in.
  if (pathname === "/newsroom-access") return NextResponse.next();

  const passphrase = process.env.NEWSROOM_PASSPHRASE;
  const expected = passphrase ? await hash(passphrase) : null;
  const presented = request.cookies.get(COOKIE)?.value;

  if (expected && presented === expected) return NextResponse.next();

  const signIn = request.nextUrl.clone();
  signIn.pathname = "/newsroom-access";
  // So a successful sign-in lands where they were headed.
  signIn.searchParams.set("next", pathname);
  if (!passphrase) signIn.searchParams.set("unconfigured", "1");

  return NextResponse.redirect(signIn);
}

export const config = {
  // Every admin route, and nothing else. The public site is untouched.
  matcher: ["/admin/:path*"],
};
