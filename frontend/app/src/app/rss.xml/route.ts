import { PROFILE, publishedStories } from "@/data/content";
import { storyCover } from "@/lib/cover";
import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * The feed.
 *
 * ── What goes in it ──────────────────────────────────────────────────────
 * Published writing only, newest first. No drafts, and no video: a report is
 * a YouTube page, and putting one in a text feed hands a subscriber an item
 * whose content is somewhere else.
 *
 * Each item carries the standfirst, not the article. A full-text feed is a
 * decision about syndication that the site's owner should make deliberately,
 * not one a feed generator makes for him — and the `link` is the canonical
 * article URL, so nothing is lost by asking a reader to follow it.
 *
 * `guid` is the canonical URL with `isPermaLink="true"`, so a reader's client
 * dedupes on the address the piece actually lives at rather than on a title
 * that might be edited later.
 */

/** XML has five characters that cannot appear raw in text or an attribute. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const dynamic = "force-static";

export function GET() {
  const stories = publishedStories();
  const updated = stories[0]?.publishedAt;

  const items = stories
    .map((story) => {
      const url = absoluteUrl(`/stories/${story.slug}`);
      const cover = storyCover(story);
      const image = cover.startsWith("http") ? cover : absoluteUrl(cover);

      return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(story.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(PROFILE.name)}</dc:creator>
      <description>${escapeXml(story.dek)}</description>
${story.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}
      <enclosure url="${escapeXml(image)}" type="image/jpeg" />
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(PROFILE.name)} — Writing</title>
    <link>${escapeXml(`${SITE_URL}/stories`)}</link>
    <atom:link href="${escapeXml(`${SITE_URL}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(`Written work by ${PROFILE.name}, journalist in ${PROFILE.base}.`)}</description>
    <language>en</language>
    <managingEditor>${escapeXml(`${PROFILE.email} (${PROFILE.name})`)}</managingEditor>${
      updated ? `\n    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>` : ""
    }
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
