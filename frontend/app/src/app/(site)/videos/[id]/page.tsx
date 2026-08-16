import type { Metadata } from "next";
import Video from "@/views/Video";
import { VIDEOS, posterFor, topicName, videoById } from "@/data/videos";
import { PROFILE } from "@/data/content";

/**
 * The channel's catalogue is a fixed, verified list, so every report can be
 * rendered at build time. Nothing here is guessed — `generateStaticParams`
 * walks the same data the page does.
 */
export function generateStaticParams() {
  return VIDEOS.map((video) => ({ id: video.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const video = videoById(id);
  if (!video) return { title: "Report not found" };

  // Built from the fields we actually hold. No invented synopsis.
  const description = `${topicName(video.topic)} — a ${video.duration} report by ${PROFILE.name}.`;

  return {
    title: video.title,
    description,
    openGraph: {
      type: "video.other",
      title: video.title,
      description,
      images: [{ url: posterFor(video.id) }],
    },
  };
}

export default async function VideoRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Video id={id} />;
}
