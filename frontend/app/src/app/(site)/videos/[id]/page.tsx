import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Video from "@/views/Video";
import { CHANNEL, VIDEOS, posterFor, topicName, videoById, watchUrl } from "@/data/videos";
import { PROFILE } from "@/data/content";
import { absoluteUrl } from "@/lib/site";

/**
 * The channel's catalogue is a fixed, verified list, so every report can be
 * rendered at build time. Nothing here is guessed — `generateStaticParams`
 * walks the same data the page does.
 */
export function generateStaticParams() {
  return VIDEOS.map((video) => ({ id: video.id }));
}

/** The catalogue is the whole set; anything outside it is a genuine 404. */
export const dynamicParams = false;

/** "2:12" as an ISO 8601 duration, which is what schema.org expects. */
function isoDuration(clock: string): string {
  const [minutes, seconds] = clock.split(":").map(Number);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return "";
  return `PT${minutes}M${seconds}S`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const video = videoById(id);
  if (!video) return { title: "Report not found", robots: { index: false, follow: false } };

  const path = `/videos/${video.id}`;
  // Built from the fields we actually hold. No invented synopsis.
  const description = `${topicName(video.topic)} — a ${video.duration} report by ${PROFILE.name}.`;

  return {
    title: video.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "video.other",
      url: absoluteUrl(path),
      siteName: PROFILE.name,
      title: video.title,
      description,
      images: [{ url: posterFor(video.id), alt: video.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [posterFor(video.id)],
    },
  };
}

export default async function VideoRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = videoById(id);

  // Was HTTP 200 with an in-page "that report isn't here" — a soft 404, which
  // asks a crawler to index an apology.
  if (!video) notFound();

  /**
   * `VideoObject`, built only from fields the channel actually reports.
   *
   * `uploadDate` is month precision because that is the precision the data
   * has — the channel gives "N months ago", which was resolved to a month, not
   * a day. `2025-11` is valid ISO 8601 and is true; `2025-11-01` would be a
   * day we invented to look more exact.
   *
   * No `description` beyond what the page states, and no `interactionStatistic`
   * for the view count: that figure is a snapshot taken when the data file was
   * written, and publishing a stale number as live structured data is a claim
   * the site cannot stand behind.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    thumbnailUrl: [posterFor(video.id)],
    uploadDate: video.published,
    duration: isoDuration(video.duration) || undefined,
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
    url: watchUrl(video.id),
    inLanguage: "en",
    author: { "@type": "Person", name: PROFILE.name, url: absoluteUrl("/about") },
    publisher: { "@type": "Person", name: PROFILE.name, url: CHANNEL.url },
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/videos/${video.id}`) },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Video id={id} />
    </>
  );
}