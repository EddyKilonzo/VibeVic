import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt
 *
 * ── What is disallowed, and what deliberately is not ─────────────────────
 * Only the internal search results, which are an infinite space of query
 * permutations: letting a crawler wander them produces thousands of thin,
 * near-duplicate URLs competing with the articles they were supposed to lead
 * to.
 *
 * The newsroom and its sign-in page used to be listed here, and that was
 * backwards. This file is public, so a `Disallow` line is a published index
 * of the paths worth looking at — the first place anything scanning a site
 * reads. Both routes carry `robots: { index: false }` in their own metadata,
 * which keeps them out of the index without announcing them, and neither is
 * reachable without the passphrase anyway.
 *
 * Nothing else is blocked. In particular the CSS, the JavaScript and the
 * images are all crawlable: Google renders pages before judging them, and a
 * site that blocks its own stylesheets is asking to be assessed on a version
 * of itself that nobody sees.
 *
 * This file is not a security control, and the admin is not protected by
 * being listed here — it is protected by the passphrase gate in
 * `middleware.ts`, which returns a redirect before any admin route renders.
 * A `Disallow` line is a request to well-behaved crawlers and an index of
 * interesting paths to everyone else.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/search"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
