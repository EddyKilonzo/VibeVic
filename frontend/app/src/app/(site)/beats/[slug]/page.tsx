import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Beat from "@/views/Beat";
import {
  GENRES,
  PROFILE,
  childBeats,
  genreBySlug,
  inGenre,
  parentBeat,
  storiesByGenre,
} from "@/data/content";
import { VIDEOS, videoBeat } from "@/data/videos";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

/**
 * A page per beat — parents and children alike, twenty-one of them.
 *
 * The taxonomy is a fixed list compiled into the site, so every one of these
 * is built ahead of time and `dynamicParams` is off: a slug outside the list
 * is a genuine 404 rather than an empty page returning 200, which is what
 * invites a crawler to index subjects that do not exist.
 *
 * Beats opened in the workspace are deliberately not here. They live in one
 * browser's storage, so there is nothing to build and nothing a reader could
 * be sent to — which is exactly what the admin tells you when you open one.
 */
export function generateStaticParams() {
  return GENRES.map((beat) => ({ slug: beat.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const beat = genreBySlug(slug);
  if (!beat) return { title: "Beat not found", robots: { index: false, follow: false } };

  const parent = parentBeat(beat.slug);
  const stories = storiesByGenre(beat.slug).length;
  const videos = VIDEOS.filter((v) => inGenre(videoBeat(v), beat.slug)).length;

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
  const beat = genreBySlug(slug);
  if (!beat) notFound();

  const parent = parentBeat(beat.slug);
  const stories = storiesByGenre(beat.slug);

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
        ...(childBeats(beat.slug).length > 0
          ? { hasPart: childBeats(beat.slug).map((c) => ({ "@id": absoluteUrl(`/beats/${c.slug}`) })) }
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
      <Beat beat={beat} />
    </>
  );
}
