import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt
 *
 * ── What is disallowed, and what deliberately is not ─────────────────────
 * The newsroom, the sign-in page and the internal search results are kept out
 * of the crawl. The first two are private working areas; the third is an
 * infinite space of query permutations, and letting a crawler wander it
 * produces thousands of thin, near-duplicate URLs competing with the articles
 * they were supposed to lead to.
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
      disallow: ["/admin", "/admin/", "/newsroom-access", "/search"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
