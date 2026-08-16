import type { Metadata } from "next";
import StoryWorkspace from "@/views/admin/StoryWorkspace";

export const metadata: Metadata = { title: "New story" };

/** A blank draft. `StoryWorkspace` starts from its BLANK template when no id. */
export default function NewStoryRoute() {
  return <StoryWorkspace />;
}
