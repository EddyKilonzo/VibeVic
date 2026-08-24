import type { Metadata } from "next";
import StoryWorkspace from "@/views/admin/StoryWorkspace";
import { getAdminStory } from "@/data/server-admin";

/**
 * The story is fetched here, on the server, and handed to the workspace as a
 * prop.
 *
 * The workspace seeds its editor state from it during the first render, so the
 * value has to be present synchronously — and it has to be the same on the
 * server and the client, or the draft hydrates against different text. A prop
 * satisfies both; a fetch inside the client component would satisfy neither.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await getAdminStory(id);
  return { title: story?.title ?? "Draft" };
}

export default async function StoryWorkspaceRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // "new" is the blank-draft route and has no record behind it, so it is not
  // worth a request that is guaranteed to 404.
  const existing = id === "new" ? null : await getAdminStory(id);

  return <StoryWorkspace id={id} existing={existing ?? undefined} />;
}
