import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Beat from "@/views/Beat";
import { PROFILE } from "@/data/content";
import { getGenres, getStories } from "@/data/server";
import {
  childBeats,
  genreBySlug,
  inGenre,
  parentBeat,
  storiesByGenre,
} from "@/lib/taxonomy";
import { VIDEOS, videoBeat } from "@/data/videos";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

/**
 * A page per beat — parents and children alike, twenty-one of them.
 *
 * The taxonomy now comes from the database, which changes two things.
 *
 * The list is fetched at build time and degrades to empty if the API cannot be
 * reached — so an outage produces pages rendered on demand rather than a failed
 * build.
 *
 * And `dynamicParams` can no longer be `false`. It was correct when the beats
 * were compiled in and the built list was exhaustive by construction; now a
 * beat added after the last build would 404 despite existing. Unknown slugs are
 * still a real 404 — the page below calls `notFound()` when the beat is not in
 * the taxonomy — so nothing returns 200 for a subject that does not exist.
 *
 * Beats opened in the workspace are deliberately still absent. They live in one
 * browser's storage, so there is nothing to build and nothing a reader could be
 * sent to — which is exactly what the admin tells you when you open one.
 */
export async function generateStaticParams() {
  const genres = await getGenres();
  return genres.map((beat) => ({ slug: beat.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [genres, allStories] = await Promise.all([getGenres(), getStories()]);

  const beat = genreBySlug(genres, slug);
  if (!beat) return { title: "Beat not found", robots: { index: false, follow: false } };

  const parent = parentBeat(genres, beat.slug);
  const stories = storiesByGenre(genres, allStories, beat.slug).length;
  const videos = VIDEOS.filter((v) => inGenre(genres, videoBeat(v), beat.slug)).length;

  /*
   * The description is the beat's own standfirst plus what is actually filed
   * under it. Counts belong in a description because they are the one thing a
   * search result cannot show and a reader wants to know before clicking —
   * and they are read from the archive, so they cannot drift.
   */
  const filed =
    stories + videos === 0
      ? "A subject covered here."
      : [
          videos > 0 ? `${videos} ${videos === 1 ? "report" : "reports"}` : null,
          stories > 0 ? `${stories} written ${stories === 1 ? "piece" : "pieces"}` : null,
        ]
          .filter(Boolean)
          .join(" and ") + ` by ${PROFILE.name}.`;

  return pageMetadata({
    title: parent ? `${beat.name} — ${parent.name}` : beat.name,
    description: `${beat.description} ${filed}`.slice(0, 300),
    path: `/beats/${beat.slug}`,
    // A beat with nothing under it is a real subject with no work yet: worth
    // linking, not worth putting in front of a searcher as a result.
    index: stories + videos > 0,
  });
}

export default async function BeatRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [genres, allStories] = await Promise.all([getGenres(), getStories()]);

  const beat = genreBySlug(genres, slug);
  if (!beat) notFound();

  const parent = parentBeat(genres, beat.slug);
  const stories = storiesByGenre(genres, allStories, beat.slug);

  /**
   * Structured data: what this page is, and what is on it.
   *
   * `CollectionPage` with an `ItemList` rather than `Article` — this page
   * lists work, it is not a piece of work, and claiming otherwise is how a
   * listing ends up competing with the articles it exists to lead to. The
   * breadcrumb is what puts "Beats › News › Kenya" under the result instead
   * of a bare URL, and it is built from the real tree, not a guess.
   */
  const crumbs = [
    { name: "Beats", url: absoluteUrl("/genres") },
    ...(parent ? [{ name: parent.name, url: absoluteUrl(`/beats/${parent.slug}`) }] : []),
    { name: beat.name, url: absoluteUrl(`/beats/${beat.slug}`) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": absoluteUrl(`/beats/${beat.slug}`),
        name: beat.name,
        description: beat.description,
        inLanguage: "en",
        isPartOf: { "@id": `${absoluteUrl("")}/#website` },
        about: { "@type": "Thing", name: beat.name },
        ...(childBeats(genres, beat.slug).length > 0
          ? {
              hasPart: childBeats(genres, beat.slug).map((c) => ({
                "@id": absoluteUrl(`/beats/${c.slug}`),
              })),
            }
          : {}),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: stories.length,
          itemListElement: stories.map((story, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/stories/${story.slug}`),
            name: story.title,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Built from our own typed data, not from anything a reader supplies.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Beat beat={beat} stories={stories} />
    </>
  );
}
