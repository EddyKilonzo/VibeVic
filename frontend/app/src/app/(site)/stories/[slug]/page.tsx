import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Story from "@/views/Story";
import { PROFILE, publishedStories, storyBySlug } from "@/data/content";
import { storyCover } from "@/lib/cover";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return publishedStories().map((story) => ({ slug: story.slug }));
}

/**
 * The published set is the whole set.
 *
 * Without this, Next treats any slug outside `generateStaticParams` as a page
 * it might render on demand, and the response for a nonexistent article came
 * back HTTP 200 — a soft 404. That is worse than a missing page: it invites a
 * crawler to index an apology, and it means a mistyped link never tells anyone
 * it was mistyped. The archive is static, so anything not in it does not
 * exist, and saying so lets the 404 carry a 404.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = storyBySlug(slug);

  // A page that does not exist gets no metadata worth indexing; the route
  // below returns a real 404 for it.
  if (!story) return { title: "Story not found", robots: { index: false, follow: false } };

  const path = `/stories/${story.slug}`;
  const image = storyCover(story);

  return {
    title: story.title,
    description: story.dek,
    // Every indexable page needs exactly one preferred address, or a crawler
    // has to guess which of several URLs is the real one.
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: absoluteUrl(path),
      title: story.title,
      description: story.dek,
      publishedTime: story.publishedAt,
      modifiedTime: story.updatedAt || story.publishedAt,
      authors: [PROFILE.name],
      tags: story.tags,
      images: [{ url: image, alt: story.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description: story.dek,
      images: [image],
    },
  };
}

export default async function StoryRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = storyBySlug(slug);

  // Was returning HTTP 200 with an empty shell for any slug at all — a soft
  // 404, which invites a crawler to index nonexistent pages and dilutes the
  // real ones. `notFound()` renders the 404 page with a 404 status.
  if (!story) notFound();

  /**
   * Structured data, generated from the same fields the page renders.
   *
   * Nothing here is invented and nothing is asserted that is not visible:
   * the headline, dates, author and image all come from the story record.
   * `isAccessibleForFree` is stated because it is true — there is no paywall
   * — and saying so is how a crawler knows the full text it can see is the
   * full text a reader gets.
   *
   * `Article` rather than `NewsArticle`: these are features and essays, and
   * claiming a news-specific type for a piece about metacognition would be
   * describing the content as something it is not.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description: story.dek,
    image: [storyCover(story)],
    datePublished: story.publishedAt,
    dateModified: story.updatedAt || story.publishedAt,
    inLanguage: "en",
    isAccessibleForFree: true,
    author: {
      "@type": "Person",
      name: PROFILE.name,
      url: absoluteUrl("/about"),
    },
    publisher: {
      "@type": "Person",
      name: PROFILE.name,
      url: SITE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/stories/${story.slug}`),
    },
    // Where a piece ran first, if it was not here. Claiming original
    // publication for syndicated work would be a false statement about
    // provenance, which on a journalist's site is worse than no markup.
    ...(story.sourceUrl ? { sameAs: story.sourceUrl } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // The payload is built from our own typed data, not from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Story slug={slug} story={story} />
    </>
  );
}
