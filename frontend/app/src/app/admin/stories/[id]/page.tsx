import type { Metadata } from "next";
import StoryWorkspace from "@/views/admin/StoryWorkspace";
import { storyById } from "@/data/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: storyById(id)?.title ?? "Draft" };
}

export default async function StoryWorkspaceRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoryWorkspace id={id} />;
}
