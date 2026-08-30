import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminLayout from "@/views/admin/AdminLayout";
import { currentSession } from "@/lib/newsroom-auth";

export const metadata: Metadata = {
  title: { default: "Newsroom", template: "%s — Newsroom" },
  // The workspace is private working space, not published work.
  robots: { index: false, follow: false },
};

/**
 * The second lock, and where the workspace learns who is using it.
 *
 * ── Why check again when the middleware already did ──────────────────────
 * The same reason `newsroom-auth.ts` gives for the route handlers. The
 * matcher is configuration: it is edited by hand, the mount comes from the
 * environment, and a route that moves out from under it fails open and
 * silently. This check is in the same file as the thing it protects, so it
 * cannot be left behind by a refactor that moves the folder.
 *
 * It is also the only place that can read the claims. Middleware runs before
 * the render and cannot hand a value to a component; the layout has the
 * cookie and can verify it once for every page beneath it.
 *
 * ── What is passed down, and what is not ─────────────────────────────────
 * Address, role and expiry. Not the token: it stays in an httpOnly cookie and
 * is forwarded to the API by server code that reads it there. A session token
 * serialised into a prop is a session token in the HTML, readable by any
 * script on the page, which is the whole thing httpOnly was for.
 */
export default async function AdminRouteLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();

  // Belt and braces with the middleware, which has already sent an
  // unauthenticated request to the door. If this ever fires, the gate in
  // front has a hole in it — but the workspace still does not render.
  if (!session) redirect("/newsroom-access");

  return (
    <AdminLayout
      session={{ email: session.email, role: session.role, expiresAt: session.exp }}
    >
      {children}
    </AdminLayout>
  );
}
