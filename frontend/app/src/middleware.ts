import { NextResponse, type NextRequest } from "next/server";
import { NEWSROOM_BASE, NEWSROOM_MOVED, ROUTE_ROOT } from "@/lib/newsroom-path";
import { verifyToken } from "@/lib/newsroom-token";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The sign-in page itself must stay reachable, or there is no way in.
  if (pathname === "/newsroom-access") return NextResponse.next();

  /*
   * The workspace answers on one path only.
   *
   * When it has been moved off the default, the route folder's own address
   * stops working: a request to `/admin/*` gets a flat 404, the same reply
   * the site gives for any path that does not exist. Not a redirect to the
   * new one — that would hand the address to the first scanner that asked.
   *
   * The public path is mapped onto the real tree with a rewrite, so the
   * routes, the links and the `next` parameter all keep working while the
   * folder on disk stays `app/admin`.
   */
  if (NEWSROOM_MOVED && pathname.startsWith(`${ROUTE_ROOT}/`)) {
    return new NextResponse(null, { status: 404 });
  }

  const passphrase = process.env.NEWSROOM_PASSPHRASE;
  const ok = await verifyToken(request.cookies.get(COOKIE)?.value);

  if (ok) {
    const response =
      NEWSROOM_MOVED && pathname.startsWith(`${NEWSROOM_BASE}/`)
        ? NextResponse.rewrite(
            new URL(`${ROUTE_ROOT}${pathname.slice(NEWSROOM_BASE.length)}${request.nextUrl.search}`, request.url),
          )
        : NextResponse.next();

    /*
     * Belt and braces on indexing. Every workspace page already sets
     * `robots: { index: false }` in its metadata, but that only helps once a
     * page has rendered — and these are pages a crawler should never be
     * holding in the first place. The header says so before the body exists.
     */
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
  }

  /*
   * An unauthenticated API call is answered, not redirected.
   *
   * A 307 to an HTML sign-in page is a useless reply to `fetch`, and the
   * caller has to guess from a Content-Type that it was refused rather than
   * served. 401 is the answer to the question that was actually asked.
   */
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: passphrase ? "Not signed in to the newsroom." : "The newsroom is not configured." },
      { status: 401 },
    );
  }

  const signIn = request.nextUrl.clone();
  signIn.pathname = "/newsroom-access";
  signIn.search = "";
  // So a successful sign-in lands where they were headed.
  signIn.searchParams.set("next", pathname);
  if (!passphrase) signIn.searchParams.set("unconfigured", "1");

  return NextResponse.redirect(signIn);
}

export const config = {
  /*
   * The workspace, and the endpoints that serve it.
   *
   * `/admin/:path*` used to be the whole matcher, which quietly meant every
   * route under `/api` was open — including one that spends money on a
   * language model per call. A route being private has to be a property of
   * where it lives, not something each handler remembers to check for
   * itself; the handlers check anyway, because two locks on a door that
   * costs money is the right number.
   */
  matcher: ["/admin/:path*", "/desk/:path*", "/newsroom/:path*", "/api/newsroom/:path*"],
};
