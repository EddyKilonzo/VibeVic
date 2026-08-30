import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessForm } from "@/components/admin/AccessForm";
import { currentSession } from "@/lib/newsroom-auth";
import { NEWSROOM_BASE } from "@/lib/newsroom-path";

export const metadata: Metadata = {
  title: "Newsroom access",
  // Never index the door to the private workspace.
  robots: { index: false, follow: false },
};

export default async function NewsroomAccess({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; unconfigured?: string; reset?: string }>;
}) {
  const params = await searchParams;

  /*
   * Already signed in? Go through, don't ask again.
   *
   * The middleware cannot do this: it lets `/newsroom-access` past
   * unconditionally, because the one person who must always reach the door is
   * the one who cannot get through it. So the page decides, and it decides
   * with the same verified cookie the middleware would have read.
   *
   * This is what makes the footer's sign-in link honest for both states —
   * signed out it is a form, signed in it is the way back to work — while
   * still never naming the mount to anyone without a session. It goes to
   * `NEWSROOM_BASE` and not to `next`: an open redirect is no better for
   * arriving with a session than for arriving without one.
   *
   * Not after a reset. That link's whole point is to be typed once with the
   * new password, and an old cookie is exactly what a reset invalidated.
   */
  if (!params.reset && (await currentSession())) {
    redirect(NEWSROOM_BASE);
  }

  return (
    <main
      id="main"
      className="honeycomb honeycomb-strong flex min-h-screen items-center justify-center px-5 py-16"
    >
      {/*
        `error` used to be a parameter here, set by the sign-in action before it
        redirected. The failure never leaves the request now — the action
        returns it and the form renders it — which keeps a message about
        somebody's credentials out of the address bar, out of history, and out
        of any log that records query strings.
      */}
      <AccessForm
        next={params.next}
        unconfigured={params.unconfigured === "1"}
        reset={params.reset === "1"}
      />
    </main>
  );
}
