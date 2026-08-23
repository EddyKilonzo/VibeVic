import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Story from "@/views/Story";
import { PROFILE, genreBySlug, parentBeat, publishedStories, storyBySlug } from "@/data/content";
import { stripInline } from "@/lib/inline";
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

/**
 * The snippet Google prints under the headline.
 *
 * The standfirst is the right source for it, but the imported pieces carry
 * WordPress's own "In Summary" lead-in, so every search result opened with
 * two words of another CMS's furniture. Google also truncates at about 160
 * characters and will happily cut mid-word, so this stops at a sentence or a
 * space instead.
 */
function metaDescription(dek: string, limit = 158): string {
  const clean = stripInline(dek).replace(/^\s*in summary[:\s—-]*/i, "").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" "))).trim()}…`;
}

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
  // Metadata is plain text by definition. Emphasis markers left in a
  // description are rendered literally by Google, Slack and every share card
  // that exists — "the **council** refused" in a search result.
  const description = metaDescription(story.dek);

  return {
    title: story.title,
    description,
    // Every indexable page needs exactly one preferred address, or a crawler
    // has to guess which of several URLs is the real one.
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: absoluteUrl(path),
      title: story.title,
      description,
      publishedTime: story.publishedAt,
      modifiedTime: story.updatedAt || story.publishedAt,
      authors: [PROFILE.name],
      tags: story.tags,
      images: [{ url: image, alt: story.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description,
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
    // Plain text, same as the meta description above — structured data is
    // read by machines that will not un-asterisk it.
    description: metaDescription(story.dek),
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

  /**
   * Where this piece sits.
   *
   * A breadcrumb is the difference between a result that reads as a URL and
   * one that reads as "Beats › News › Kenya". It is built from the real
   * taxonomy — the beat the story is actually filed under and its parent, if
   * it has one — so it can never claim a path the site does not have.
   */
  const beat = genreBySlug(story.genre);
  const beatParent = parentBeat(story.genre);
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Writing", url: absoluteUrl("/stories") },
      ...(beatParent ? [{ name: beatParent.name, url: absoluteUrl(`/beats/${beatParent.slug}`) }] : []),
      ...(beat ? [{ name: beat.name, url: absoluteUrl(`/beats/${beat.slug}`) }] : []),
      { name: story.title, url: absoluteUrl(`/stories/${story.slug}`) },
    ].map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // The payload is built from our own typed data, not from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <Story slug={slug} story={story} />
    </>
  );
}
