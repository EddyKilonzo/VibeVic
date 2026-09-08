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
  // The throwing reader, still, though it no longer decides what exists: an
  // empty list from an unreachable API would ship a build that looks fine and
  // renders every article on demand, one cold API read at a time.
  const stories = await getStoriesForParams();
  return stories.map((story) => ({ slug: story.slug }));
}

/**
 * On, because the published set stopped being fixed at build time.
 *
 * This flag has been both ways and both readings were right about their own
 * moment. It was `false` because Next refuses an unrouted param before the page
 * runs, which is the only thing that reliably makes a mistyped URL answer 404
 * with a 404 — an earlier `true` had every wrong address rendering the 404 page
 * inside a **200**.
 *
 * What has changed since is that publishing is no longer a 501 stub. It writes,
 * so the archive grows between deploys, and `false` turned each new piece into
 * a hard 404 at the address the writer had just shared — two of them, by the
 * time this was found.
 *
 * `true` is safe now because the soft 404 has been fixed at its actual cause,
 * which was never this flag. A `loading.tsx` above this segment made Next flush
 * a 200 shell before `generateMetadata` had decided anything, so the
 * `notFound()` below arrived after the status line had gone out. The skeleton
 * that did it is gone from this route (see the note in `(site)/(home)`), and
 * with no Suspense boundary above it the metadata check runs before the
 * response is committed. Verified against a production build: an unknown slug
 * answers 404, a slug published after the build renders and answers 200.
 *
 * The build-time risk stays handled where it belongs: `generateStaticParams`
 * throws if the API is unreachable, so a bad build fails rather than shipping a
 * site whose every article has to be rendered on demand.
 *
 * Publishing also calls `revalidatePath` for this route, so a piece is at its
 * address the moment it goes out rather than on its first cold render.
 */
export const dynamicParams = true;

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
