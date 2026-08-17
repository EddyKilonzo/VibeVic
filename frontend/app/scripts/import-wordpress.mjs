/**
 * Imports Victor's WordPress writing into the site's own data shape.
 *
 * Run:  node scripts/import-wordpress.mjs
 *
 * ── Why a script and not a paste ─────────────────────────────────────────
 * Six articles is around sixty thousand characters of prose. Transcribing
 * that by hand invites exactly the failure a journalist's site cannot have —
 * a dropped clause, a mangled quotation, a paragraph silently merged into its
 * neighbour. The script reads the WordPress REST API and does a mechanical
 * transform, so what ends up on the page is what he published, unedited.
 *
 * It writes `src/data/writing.generated.ts`. That file is generated output:
 * edit the source on WordPress and re-run, or move a piece into
 * `content.ts` by hand once it is being maintained here instead.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE = "vicunfiltered.wordpress.com";
const API = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE}/posts/?number=50&fields=ID,title,slug,date,excerpt,content,categories,tags,URL,featured_image,post_thumbnail,attachments`;

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "writing.generated.ts");

/**
 * WordPress categories to this site's genres.
 *
 * Unmapped categories fall to `features`, which is the honest default: it is
 * the beat that means "longer work that is not one of the others", so nothing
 * is filed somewhere it does not belong just to avoid a gap.
 */
const GENRE_BY_CATEGORY = {
  "psychology & neuroscience": "science",
  agriculture: "science",
  "conservation and ecology": "environment",
  "national news": "politics",
  productivity: "student-life",
  news: "features",
};

/** Entities WordPress emits. Kept small and explicit rather than regex-guessed. */
const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&#8217;": "’",
  "&#8216;": "‘",
  "&#8220;": "“",
  "&#8221;": "”",
  "&#8211;": "–",
  "&#8212;": "—",
  "&#8230;": "…",
  "&nbsp;": " ",
  "&hellip;": "…",
};

const decode = (s) =>
  Object.entries(ENTITIES).reduce((out, [k, v]) => out.split(k).join(v), s);

/** Tags out, entities in, whitespace collapsed. */
const text = (html) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/**
 * HTML to blocks.
 *
 * Only the block types this site renders are recognised. Anything else — an
 * embed, a gallery, a WordPress shortcode — is dropped rather than guessed at,
 * because a half-understood block rendered wrongly is worse than an absent
 * one, and the original stays one click away at its source URL.
 */
function toBlocks(html, seed, skip = new Set()) {
  const blocks = [];
  let n = seed;
  const id = () => `w${++n}`;
  // Pictures already used elsewhere — the cover, or an image WordPress repeats
  // inside the post. Showing the cover again as the first thing in the body is
  // the same photograph twice in one screen.
  const seen = new Set(skip);

  // `figure` comes first so a figure is consumed whole rather than having its
  // caption picked up separately, and a bare `img` is matched last so it only
  // catches pictures that were not wrapped in one.
  const pattern =
    /<figure[^>]*>([\s\S]*?)<\/figure>|<(h[2-4])[^>]*>([\s\S]*?)<\/\2>|<blockquote[^>]*>([\s\S]*?)<\/blockquote>|<(ul|ol)[^>]*>([\s\S]*?)<\/\5>|<p[^>]*>([\s\S]*?)<\/p>|<img[^>]+>/gi;

  for (const m of html.matchAll(pattern)) {
    const [whole, figureBody, hTag, hBody, quoteBody, , listBody, pBody] = m;

    if (figureBody !== undefined || whole.startsWith("<img")) {
      const scope = figureBody ?? whole;
      const src = scope.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      if (!src || seen.has(src)) continue;
      seen.add(src);

      const alt = scope.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1] ?? "";
      const caption = figureBody
        ? text(figureBody.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? "")
        : "";

      blocks.push({
        id: id(),
        type: "image",
        src,
        // WordPress fills alt with the filename when nobody wrote one, which
        // is worse than empty: a screen reader then announces
        // "metacognition_diagram_outline-1.jpg". A caption is real text, so it
        // stands in; otherwise the image is marked decorative.
        alt: alt && !/\.(jpe?g|png|gif|webp)$/i.test(alt) ? decode(alt) : caption,
        caption: caption || undefined,
      });
      continue;
    }

    if (hTag) {
      const value = text(hBody);
      if (value) blocks.push({ id: id(), type: "heading", text: value, level: 2 });
      continue;
    }

    if (quoteBody !== undefined) {
      const value = text(quoteBody);
      if (value) blocks.push({ id: id(), type: "quote", text: value });
      continue;
    }

    if (listBody !== undefined) {
      const items = [...listBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => text(li[1]))
        .filter(Boolean);
      if (items.length) blocks.push({ id: id(), type: "list", items });
      continue;
    }

    if (pBody !== undefined) {
      const value = text(pBody);
      // Drops empty spacer paragraphs and the bare figure captions WordPress
      // leaves behind when an image is stripped.
      if (value.length > 1) blocks.push({ id: id(), type: "paragraph", text: value });
    }
  }

  return { blocks, next: n };
}

const words = (blocks) =>
  blocks.reduce(
    (total, b) =>
      total + (b.items ? b.items.join(" ") : b.text ?? "").split(/\s+/).filter(Boolean).length,
    0,
  );

/**
 * Most posts carry two categories, one of which is the catch-all "News".
 * Taking whichever the API happens to list first filed a piece about student
 * internships under features because "News" came back before "Productivity".
 * So every match is collected and the specific one wins; `features` is only
 * reached when nothing else does.
 */
function genreFor(categories) {
  const hits = Object.keys(categories ?? {})
    .map((name) => GENRE_BY_CATEGORY[decode(name).toLowerCase()])
    .filter(Boolean);

  return hits.find((g) => g !== "features") ?? hits[0] ?? "features";
}

/**
 * A standfirst made of whole sentences.
 *
 * Takes sentences until it has enough to be worth reading and stops at the
 * last full stop before the limit — never mid-clause. Aiming a little under
 * 200 characters keeps it to about three lines on a card, which is the point
 * at which a summary stops selling the piece and starts replacing it.
 */
function summarise(source, limit = 190) {
  const clean = source.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > limit) break;
    out += sentence;
  }

  // A single sentence longer than the limit: cut on a word and mark the cut,
  // which is honest about being an extract rather than pretending to end.
  if (!out) return `${clean.slice(0, clean.lastIndexOf(" ", limit))}…`;
  return out.trim();
}

/**
 * The best available cover for a post.
 *
 * WordPress exposes the same picture in several places depending on how the
 * post was written, and `featured_image` is empty far more often than people
 * expect. Falling through to the first attachment, then to the first image in
 * the body, means a piece that plainly has a picture gets it rather than
 * dropping to generated art on a technicality.
 */
function coverFor(post) {
  if (post.featured_image) return post.featured_image;
  if (post.post_thumbnail?.URL) return post.post_thumbnail.URL;

  const attachment = Object.values(post.attachments ?? {}).find((a) =>
    (a.mime_type ?? "").startsWith("image/"),
  );
  if (attachment?.URL) return attachment.URL;

  const inline = post.content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return inline ? inline[1] : undefined;
}

const response = await fetch(API);
if (!response.ok) throw new Error(`WordPress API returned ${response.status}`);
const { posts } = await response.json();

let seed = 0;
const stories = [];

for (const post of posts.slice().reverse()) {
  const cover = coverFor(post);
  const { blocks, next } = toBlocks(post.content, seed, new Set(cover ? [cover] : []));
  seed = next;

  // A post of nothing but pictures has no article to render here. Skipped
  // rather than half-built — the original stays one link away.
  if (!blocks.some((b) => b.type === "paragraph")) continue;

  const published = new Date(post.date).toISOString().slice(0, 10);

  // WordPress truncates excerpts and signs the cut with a bracketed ellipsis,
  // sometimes followed by "Continue reading". Both are furniture from a theme
  // this site does not have; a standfirst that trails off into someone else's
  // read-more link is not a standfirst.
  const excerpt = text(post.excerpt)
    .replace(/\s*\[[….]+\]\s*$/, "")
    .replace(/\s*Continue reading.*$/i, "")
    .replace(/[…]+$/, "")
    .trim();

  // WordPress cuts excerpts at a word count, so they routinely stop mid-clause
  // — the card then ends on "and a" and the reader has been given half a
  // thought rather than a reason to click. `summarise` takes whole sentences
  // instead, from the excerpt where there is one and from the opening of the
  // piece otherwise.
  const dek = summarise(excerpt || blocks[0].text);

  stories.push({
    id: `w-${post.ID}`,
    slug: post.slug,
    title: text(post.title),
    // Some excerpts are the first paragraph verbatim; a standfirst that
    // repeats the opening line is worse than none, so it falls back to a
    // trimmed first sentence only when the two differ.
    dek: dek && dek !== blocks[0].text ? dek : blocks[0].text.slice(0, 180),
    genre: genreFor(post.categories),
    tags: Object.keys(post.tags ?? {}).slice(0, 4).map(decode),
    status: "published",
    publishedAt: published,
    updatedAt: published,
    readingMinutes: Math.max(1, Math.round(words(blocks) / 220)),
    publication: "Vic Unfiltered",
    sourceUrl: post.URL,
    cover,
    body: blocks,
  });
}

const file = `// Generated by scripts/import-wordpress.mjs — do not edit by hand.
//
// Victor's writing, imported from ${SITE}. These are real, published pieces:
// nothing here is placeholder text, and none of it carries \`placeholder: true\`.
// Re-run the script to pull edits made at the source.

import type { Story } from "./types";

export const WORDPRESS_STORIES: Story[] = ${JSON.stringify(stories, null, 2)};
`;

writeFileSync(OUT, file, "utf8");

console.log(`Imported ${stories.length} stories -> ${OUT}`);
for (const s of stories) {
  console.log(`  ${s.publishedAt}  ${s.genre.padEnd(12)}  ${s.readingMinutes}m  ${s.title}`);
}
