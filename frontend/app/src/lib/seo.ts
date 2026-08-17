import type { Metadata } from "next";
import { PROFILE } from "@/data/content";
import { absoluteUrl } from "./site";

/**
 * Metadata for an ordinary public page.
 *
 * ── Why a helper rather than eight hand-written objects ──────────────────
 * Every route was writing its own `{ title, description }` and stopping
 * there, so eight pages shipped with no canonical, no Open Graph URL and no
 * social card. The failure mode of hand-rolling this is not that one page is
 * wrong; it is that the *next* page added quietly omits whichever field the
 * author forgot. One function means a route cannot forget.
 *
 * The canonical is a path, not an absolute URL: Next resolves it against
 * `metadataBase`, so there is one place that decides the origin and no route
 * can disagree with it.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  index = true,
}: {
  title: string;
  description: string;
  /** Site-relative, e.g. `/stories`. */
  path: string;
  /** Absolute or site-relative. Falls back to the site card. */
  image?: string;
  /** `false` for pages with nothing stable to index, such as search results. */
  index?: boolean;
}): Metadata {
  const card = image ?? "/images/victor-kiplimo-portrait.webp";
  const full = `${title} — ${PROFILE.name}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: absoluteUrl(path),
      siteName: PROFILE.name,
      title: full,
      description,
      images: [{ url: card, alt: PROFILE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [card],
    },
  };
}
