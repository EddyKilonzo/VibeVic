import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminIdeas from "@/views/admin/AdminIdeas";
import { RoleWall } from "@/components/admin/RoleWall";
import { currentSession } from "@/lib/newsroom-auth";
import { can } from "@/lib/newsroom-scopes";

export const metadata: Metadata = { title: "Ideas" };

/**
 * The notebook, and the one editorial screen a DEV cannot open.
 *
 * The rail does not offer this row to a developer, but a rail is not a lock —
 * the URL is typeable and this route is reachable. The check runs here,
 * server-side, so the view's own data fetching never starts: `AdminIdeas`
 * would call `/api/newsroom/records/ideas`, which the API would refuse, and
 * an admin screen full of red error cards is a worse answer than a sentence
 * saying whose screen it is.
 */
export default async function IdeasRoute() {
  const session = await currentSession();
  // Belt and braces with the middleware and the layout above, both of which
  // have already turned an unauthenticated request away.
  if (!session) redirect("/newsroom-access");

  if (!can(session.role, "newsroom:ideas")) {
    return <RoleWall role={session.role} scope="newsroom:ideas" what="The ideas notebook" />;
  }

  return <AdminIdeas />;
}
