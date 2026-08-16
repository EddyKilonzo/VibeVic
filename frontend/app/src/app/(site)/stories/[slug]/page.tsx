import type { Metadata } from "next";
import Story from "@/views/Story";
import { PROFILE, publishedStories, storyBySlug } from "@/data/content";

export function generateStaticParams() {
  return publishedStories().map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = storyBySlug(slug);
  if (!story) return { title: "Story not found" };

  return {
    title: story.title,
    description: story.dek,
    openGraph: {
      type: "article",
      title: story.title,
      description: story.dek,
      publishedTime: story.publishedAt,
      authors: [PROFILE.name],
    },
  };
}

export default async function StoryRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Story slug={slug} />;
}
