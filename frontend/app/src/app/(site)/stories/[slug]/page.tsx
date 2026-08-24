import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Story from "@/views/Story";
import { PROFILE } from "@/data/content";
import { getGenres, getStories, getStoriesForParams, getStory } from "@/data/server";
import { genreBySlug, parentBeat, relatedStories } from "@/lib/taxonomy";
import { stripInline } from "@/lib/inline";
import { storyCover } from "@/lib/cover";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export async function generateStaticParams() {
  // The throwing reader: this list *is* the set of pages that exist, so an
  // empty one caused by an unreachable API would 404 the whole archive.
  const stories = await getStoriesForParams();
  return stories.map((story) => ({ slug: story.slug }));
}

/**
 * The published set is the whole set.
 *
 * This was briefly `true`, on the reasoning that a story published after the
 * last build should still be reachable. It was the wrong trade, and testing the
 * built site is what showed it: with `true`, an unknown slug renders the 404
 * page inside a **200** response. `notFound()` does not change that — the page
 * has already begun — so every mistyped link became a soft 404, which is worse
 * than a missing page: it invites a crawler to index an apology and never tells
 * a reader the URL was wrong.
 *
 * With `false`, Next refuses an unrouted param before the page runs, and the
 * 404 carries a 404. The cost is that a newly published story needs a build to
 * become reachable. That costs nothing today — publishing is still a 501 stub —
 * and when it is implemented it should call `revalidatePath` rather than this
 * flag being flipped back.
 *
 * The build-time risk that prompted the change is handled where it belongs:
 * `generateStaticParams` now throws if the API is unreachable, so a bad build
 * fails instead of quietly shipping a site where nothing can be read.
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
  const story = await getStory(slug);

  /**
   * Not "return some metadata and let the page 404" — `notFound()` here.
   *
   * Metadata resolves before the page streams, so returning successfully from
   * this function commits a 200 status line. The `notFound()` in the component
   * below then had nothing left to set: it rendered the 404 page inside a 200
   * response, which is the soft 404 `dynamicParams = false` used to prevent and
   * which this route reintroduced when that flag was turned on.
   *
   * Throwing here aborts before the response is committed, so a mistyped URL
   * answers 404 with a 404 — while a genuinely new story is still reachable.
   */
  if (!story) notFound();

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
  const [story, genres, allStories] = await Promise.all([
    getStory(slug),
    getGenres(),
    getStories(),
  ]);

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
  const beat = genreBySlug(genres, story.genre);
  const beatParent = parentBeat(genres, story.genre);
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
      <Story slug={slug} story={story} related={relatedStories(allStories, story)} />
    </>
  );
}
